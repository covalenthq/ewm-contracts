//SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract OperationalStaking is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public constant DIVIDER = 10**18; // 18 decimals used for scaling rates
    uint128 public constant REWARD_REDEEM_THRESHOLD = 10**8; // minimum number of tokens that can be redeemed

    IERC20Upgradeable public CQT;
    uint128 public rewardPool; // how many tokens are allocated for rewards
    uint128 public validatorCoolDown; // how many blocks until validator unstaking is unlocked
    uint128 public delegatorCoolDown; // how many blocks until delegator unstaking is unlocked
    uint128 public maxCapMultiplier; // *see readme
    uint128 public validatorMaxStake; // how many tokens validators can stake at most
    address public stakingManager;
    uint128 public validatorsN; // number of validators, used to get validator ids
    mapping(uint128 => Validator) internal _validators; // id -> validator instance

    struct Staking {
        uint128 shares; // # of validator shares that the delegator owns
        uint128 staked; // # of CQT that a delegator delegated originally through stake() transaction
    }

    struct Unstaking {
        uint128 coolDownEnd; // epoch when unstaking can be redeemed
        uint128 amount; // # of unstaked CQT
    }

    struct Validator {
        uint128 commissionAvailableToRedeem;
        uint128 exchangeRate; // validator exchange rate
        address _address; // wallet address of the operator which is mapped to the validator instance
        uint128 delegated; // track amount of tokens delegated
        uint128 totalShares; // total number of validator shares
        uint128 commissionRate;
        uint256 disabledAtBlock;
        mapping(address => Staking) stakings;
        mapping(address => Unstaking[]) unstakings;
    }

    event Initialized(address cqt, uint128 validatorCoolDown, uint128 delegatorCoolDown, uint128 maxCapMultiplier, uint128 validatorMaxStake);

    event RewardTokensDeposited(uint128 amount);

    event ValidatorAdded(uint128 indexed id, uint128 commissionRate, address indexed validator);

    event Staked(uint128 indexed validatorId, address delegator, uint128 amount);

    event Unstaked(uint128 indexed validatorId, address indexed delegator, uint128 amount, uint128 unstakeId);

    event RecoveredUnstake(uint128 indexed validatorId, address indexed delegator, uint128 amount, uint128 unstakingId);

    event UnstakeRedeemed(uint128 indexed validatorId, address indexed delegator, uint128 indexed unstakeId, uint128 amount);

    event AllocatedTokensTaken(uint128 amount);

    event RewardFailedDueLowPool(uint128 indexed validatorId, uint128 amount);

    event RewardFailedDueZeroStake(uint128 indexed validatorId, uint128 amount);

    event RewardRedeemed(uint128 indexed validatorId, address indexed beneficiary, uint128 amount);

    event CommissionRewardRedeemed(uint128 indexed validatorId, address indexed beneficiary, uint128 amount);

    event StakingManagerAddressChanged(address indexed operationalManager);

    event ValidatorCommissionRateChanged(uint128 indexed validatorId, uint128 amount);

    event ValidatorMaxCapChanged(uint128 amount);

    event ValidatorDisabled(uint128 indexed validatorId, uint256 blockNumber);

    event Redelegated(uint128 indexed oldValidatorId, uint128 indexed newValidatorId, address indexed delegator, uint128 amount, uint128 unstakingId);

    event MaxCapMultiplierChanged(uint128 newMaxCapMultiplier);

    event ValidatorEnabled(uint128 indexed validatorId);

    event ValidatorAddressChanged(uint128 indexed validatorId, address indexed newAddress);

    modifier onlyStakingManager() {
        require(stakingManager == msg.sender, "Caller is not stakingManager");
        _;
    }

    function initialize(
        address cqt,
        uint128 dCoolDown,
        uint128 vCoolDown,
        uint128 maxCapM,
        uint128 vMaxStake
    ) external initializer {
        __Ownable_init();
        validatorCoolDown = vCoolDown; // 180*6857 = ~ 6 months
        delegatorCoolDown = dCoolDown; //  28*6857 = ~ 28 days
        maxCapMultiplier = maxCapM;
        validatorMaxStake = vMaxStake;
        CQT = IERC20Upgradeable(cqt);
        emit Initialized(cqt, vCoolDown, dCoolDown, maxCapM, vMaxStake);
    }

    function setStakingManagerAddress(address newAddress) external onlyOwner {
        stakingManager = newAddress;
        emit StakingManagerAddressChanged(newAddress);
    }

    /*
     * Transfer CQT from the owner to the contract for reward allocation
     */
    function depositRewardTokens(uint128 amount) external onlyOwner {
        require(amount > 0, "Amount is 0");
        unchecked {
            rewardPool += amount;
        }
        _transferToContract(msg.sender, amount);
        emit RewardTokensDeposited(amount);
    }

    /*
     * Transfer reward CQT from the contract to the owner
     */
    function takeOutRewardTokens(uint128 amount) external onlyOwner {
        require(amount > 0, "Amount is 0");
        require(amount <= rewardPool, "Reward pool is too small");
        unchecked {
            rewardPool -= amount;
        }
        emit AllocatedTokensTaken(amount);
        _transferFromContract(msg.sender, amount);
    }

    /*
     * Updates validator max cap multiplier that determines how many tokens can be delegated
     */
    function setMaxCapMultiplier(uint128 newMaxCapMultiplier) external onlyOwner {
        require(newMaxCapMultiplier > 0, "Must be greater than 0");
        maxCapMultiplier = newMaxCapMultiplier;
        emit MaxCapMultiplierChanged(newMaxCapMultiplier);
    }

    /*
     * Updates maximum number of tokens that a validator can stake
     */
    function setValidatorMaxStake(uint128 maxStake) external onlyOwner {
        require(maxStake > 0, "Provided max stake is 0");
        validatorMaxStake = maxStake;
        emit ValidatorMaxCapChanged(maxStake);
    }

    /*
     * Adds new validator instance
     */
    function addValidator(address validator, uint128 commissionRate) external onlyStakingManager returns (uint256 id) {
        require(commissionRate < DIVIDER, "Rate must be less than 100%");
        require(validator != address(0), "Validator address is 0");
        uint128 N = validatorsN; // use current number of validators for the id of a new validator instance
        _validators[N]._address = validator;
        _validators[N].exchangeRate = uint128(DIVIDER); // make it 1:1 initially
        _validators[N].commissionRate = commissionRate;
        _validators[N].disabledAtBlock = 1; // set it to 1 to indicate that the validator is disabled

        emit ValidatorAdded(N, commissionRate, validator);
        unchecked {
            validatorsN += 1;
        }

        return N;
    }

    /*
     * Reward emission
     */
    function rewardValidators(uint128[] calldata ids, uint128[] calldata amounts) external onlyStakingManager {
        uint128 newRewardPool = rewardPool;
        uint128 amount;
        uint128 validatorId;
        uint128 commissionPaid;
        uint128 rewardAmount;

        for (uint256 j = 0; j < ids.length; j++) {
            amount = amounts[j];
            validatorId = ids[j];
            // make sure there are enough tokens in the reward pool
            if (newRewardPool < amount) {
                emit RewardFailedDueLowPool(validatorId, amount);
            } else {
                Validator storage v = _validators[validatorId];
                // make sure validator has tokens staked (nothing was unstaked right before the reward emission)
                uint256 totalShares = uint256(v.totalShares);
                if (totalShares == 0) {
                    emit RewardFailedDueZeroStake(validatorId, amount);
                } else {
                    commissionPaid = uint128((uint256(amount) * uint256(v.commissionRate)) / DIVIDER);
                    rewardAmount = amount - commissionPaid;
                    v.exchangeRate += uint128(((amount - commissionPaid) * DIVIDER) / totalShares); // distribute the tokens by increasing the exchange rate
                    // commission is not compounded
                    // commisison is distributed under the validator instance
                    v.commissionAvailableToRedeem += commissionPaid;

                    newRewardPool -= amount;
                }
            }
        }
        rewardPool = newRewardPool; // can never access these tokens anymore, reserved for validator rewards
    }

    /*
     * Disables validator instance starting from the given block
     */
    function disableValidator(uint128 validatorId, uint256 blockNumber) external onlyStakingManager {
        require(validatorId < validatorsN, "Invalid validator");
        require(blockNumber > 0, "Disable block cannot be 0");
        _validators[validatorId].disabledAtBlock = blockNumber;
        emit ValidatorDisabled(validatorId, blockNumber);
    }

    /*
     * Enables validator instance by setting the disabledAtBlock to 0
     */
    function enableValidator(uint128 validatorId) external onlyStakingManager {
        require(validatorId < validatorsN, "Invalid validator");
        _validators[validatorId].disabledAtBlock = 0;
        emit ValidatorEnabled(validatorId);
    }

    /*
     * Updates validator comission rate
     * Commission rate is a number between 0 and 10^18 (0%-100%)
     */
    function setValidatorCommissionRate(uint128 validatorId, uint128 amount) external onlyOwner {
        require(validatorId < validatorsN, "Invalid validator");
        require(amount < DIVIDER, "Rate must be less than 100%");
        _validators[validatorId].commissionRate = amount;
        emit ValidatorCommissionRateChanged(validatorId, amount);
    }

    /*
     * Used to transfer CQT from delegators, validators, and the owner to the contract
     */
    function _transferToContract(address from, uint128 amount) internal {
        CQT.safeTransferFrom(from, address(this), amount);
    }

    /*
     * Used to transfer CQT from contract, for reward redemption or transferring out unstaked tokens
     */
    function _transferFromContract(address to, uint128 amount) internal {
        CQT.safeTransfer(to, amount);
    }

    /*
     * Used to convert validator shares to CQT
     */
    function _sharesToTokens(uint128 sharesN, uint128 rate) internal pure returns (uint128) {
        return uint128((uint256(sharesN) * uint256(rate)) / DIVIDER);
    }

    /*
     * Used to convert CQT to validator shares
     */
    function _tokensToShares(uint128 amount, uint128 rate) internal pure returns (uint128) {
        return uint128((uint256(amount) * DIVIDER) / uint256(rate));
    }

    /*
     * Delegates tokens under the provided validator
     */
    function stake(uint128 validatorId, uint128 amount) external {
        _stake(validatorId, amount, true);
    }

    /*
     * withTransfer is set to false when delegators recover unstaked or redelegated tokens.
     * These tokens are already in the contract.
     */
    function _stake(
        uint128 validatorId,
        uint128 amount,
        bool withTransfer
    ) internal {
        require(validatorId < validatorsN, "Invalid validator");
        require(amount >= REWARD_REDEEM_THRESHOLD, "Stake amount is too small");
        Validator storage v = _validators[validatorId];
        bool isValidator = msg.sender == v._address;

        // validators should be able to stake if they are disabled.
        if (!isValidator) require(v.disabledAtBlock == 0, "Validator is disabled");

        uint128 sharesAdd = _tokensToShares(amount, v.exchangeRate);
        Staking storage s = v.stakings[msg.sender];

        if (isValidator) {
            // the compounded rewards are not included in max stake check
            // hence we use s.staked instead of s.shares for valueStaked calculation
            uint128 valueStaked = s.staked + _sharesToTokens(sharesAdd, v.exchangeRate);
            require(valueStaked <= validatorMaxStake, "Validator max stake exceeded");
        } else {
            // cannot stake more than validator delegation max cap
            uint128 delegationMaxCap = v.stakings[v._address].staked * maxCapMultiplier;
            uint128 newDelegated = v.delegated + amount;
            require(newDelegated <= delegationMaxCap, "Validator max delegation exceeded");
            v.delegated = newDelegated;
        }

        // "buy/mint" shares
        v.totalShares += sharesAdd;
        s.shares += sharesAdd;

        // keep track of staked tokens
        s.staked += amount;
        if (withTransfer) _transferToContract(msg.sender, amount);
        emit Staked(validatorId, msg.sender, amount);
    }

    /*
     * Undelegates tokens from the provided validator
     */
    function unstake(uint128 validatorId, uint128 amount) external {
        require(validatorId < validatorsN, "Invalid validator");
        require(amount >= REWARD_REDEEM_THRESHOLD, "Unstake amount is too small");
        Validator storage v = _validators[validatorId];
        Staking storage s = v.stakings[msg.sender];
        require(s.staked >= amount, "Staked < amount provided");

        bool isValidator = msg.sender == v._address;
        if (isValidator && v.disabledAtBlock == 0) {
            // validators will have to disable themselves if they want to unstake tokens below delegation max cap
            uint128 newValidatorMaxCap = (s.staked - amount) * maxCapMultiplier;
            require(v.delegated <= newValidatorMaxCap, "Cannot unstake beyond max cap");
        }
        if (!isValidator) {
            v.delegated -= amount;
        }

        uint128 sharesRemove = _tokensToShares(amount, v.exchangeRate);
        // "sell/burn" shares
        // sometimes due to conversion inconsisencies shares to remove might end up being bigger than shares stored
        // so we have to reassign it to allow the full unstake
        if (sharesRemove > s.shares) sharesRemove = s.shares;

        s.shares -= sharesRemove;
        v.totalShares -= sharesRemove;

        // remove staked tokens
        s.staked -= amount;
        // create unstaking instance
        uint128 coolDownEnd = uint128(v.disabledAtBlock != 0 ? v.disabledAtBlock : block.number);
        unchecked {
            coolDownEnd += (isValidator ? validatorCoolDown : delegatorCoolDown);
        }
        uint128 unstakeId = uint128(v.unstakings[msg.sender].length);
        v.unstakings[msg.sender].push(Unstaking(coolDownEnd, amount));
        emit Unstaked(validatorId, msg.sender, amount, unstakeId);
    }

    /*
     * Restakes unstaked tokens
     */
    function recoverUnstaking(
        uint128 amount,
        uint128 validatorId,
        uint128 unstakingId
    ) external {
        require(validatorId < validatorsN, "Invalid validator");
        require(_validators[validatorId].unstakings[msg.sender].length > unstakingId, "Unstaking does not exist");
        Unstaking storage us = _validators[validatorId].unstakings[msg.sender][unstakingId];
        require(us.amount >= amount, "Unstaking has less tokens");
        _stake(validatorId, amount, false);
        us.amount -= amount;
        // set cool down end to 0 to release gas if new unstaking amount is 0
        if (us.amount == 0) us.coolDownEnd = 0;
        emit RecoveredUnstake(validatorId, msg.sender, amount, unstakingId);
    }

    /*
     * Transfers out unlocked unstaked tokens back to the delegator
     */
    function transferUnstakedOut(
        uint128 amount,
        uint128 validatorId,
        uint128 unstakingId
    ) external {
        require(validatorId < validatorsN, "Invalid validator");
        require(_validators[validatorId].unstakings[msg.sender].length > unstakingId, "Unstaking does not exist");
        Unstaking storage us = _validators[validatorId].unstakings[msg.sender][unstakingId];
        require(uint128(block.number) > us.coolDownEnd, "Cooldown period has not ended");
        require(us.amount >= amount, "Amount is too high");
        unchecked {
            us.amount -= amount;
        }
        // set cool down end to 0 to release gas if new unstaking amount is 0
        if (us.amount == 0) us.coolDownEnd = 0;
        emit UnstakeRedeemed(validatorId, msg.sender, unstakingId, amount);
        _transferFromContract(msg.sender, amount);
    }

    /*
     * Redeems all available rewards
     */
    function redeemAllRewards(uint128 validatorId, address beneficiary) external {
        _redeemRewards(validatorId, beneficiary, 0); // pass 0 to request full amount
    }

    /*
     * Redeems partial rewards
     */
    function redeemRewards(
        uint128 validatorId,
        address beneficiary,
        uint128 amount
    ) external {
        require(amount > 0, "Amount is 0");
        _redeemRewards(validatorId, beneficiary, amount);
    }

    function _redeemRewards(
        uint128 validatorId,
        address beneficiary,
        uint128 amount
    ) internal {
        require(validatorId < validatorsN, "Invalid validator");
        require(beneficiary != address(0x0), "Invalid beneficiary");
        Validator storage v = _validators[validatorId];
        Staking storage s = v.stakings[msg.sender];

        // how many tokens a delegator/validator has in total on the contract
        // include earned commission if the delegator is the validator
        uint128 totalValue = _sharesToTokens(s.shares, v.exchangeRate);

        bool redeemAll = amount == 0; // amount is 0 when it's requested to redeem all rewards
        if (redeemAll) {
            // can only redeem > redeem threshold
            require(totalValue - s.staked >= REWARD_REDEEM_THRESHOLD, "Nothing to redeem");
        }
        // making sure that amount of rewards exist
        else {
            require(totalValue - s.staked >= amount, "Requested amount is too high");
            require(amount >= REWARD_REDEEM_THRESHOLD, "Nothing to redeem");
        }

        uint128 amountToRedeem = redeemAll ? totalValue - s.staked : amount;
        uint128 stakeRewardToRedeem = amountToRedeem; // this will initially constraint commission paid and regular reward
        uint128 comissionRewardToRedeem;

        if (stakeRewardToRedeem != 0) {
            // "sell/burn" the reward shares
            uint128 validatorSharesRemove = _tokensToShares(stakeRewardToRedeem, v.exchangeRate);
            unchecked {
                v.totalShares -= validatorSharesRemove;
            }
            unchecked {
                s.shares -= validatorSharesRemove;
            }
        }
        emit RewardRedeemed(validatorId, beneficiary, stakeRewardToRedeem);
        _transferFromContract(beneficiary, stakeRewardToRedeem + comissionRewardToRedeem);
    }

    function redeemCommission(
        uint128 validatorId,
        address beneficiary,
        uint128 amount
    ) public {
        require(validatorId < validatorsN, "Invalid validator");
        require(beneficiary != address(0x0), "Invalid beneficiary");
        Validator storage v = _validators[validatorId];
        require(v._address == msg.sender, "The sender is not the validator");
        require(amount > 0, "The requested amount is 0");

        require(v.commissionAvailableToRedeem > 0, "No commission available to redeem");
        require(amount <= v.commissionAvailableToRedeem, "Requested amount is higher than commission available to redeem");
        v.commissionAvailableToRedeem -= amount;

        _transferFromContract(beneficiary, amount);
        emit CommissionRewardRedeemed(validatorId, beneficiary, amount);
    }

    function redeemAllCommission(uint128 validatorId, address beneficiary) external {
        redeemCommission(validatorId, beneficiary, _validators[validatorId].commissionAvailableToRedeem);
    }

    /*
     * Redelegates tokens to another validator if a validator got disabled.
     * First the tokens need to be unstaked
     */
    function redelegateUnstaked(
        uint128 amount,
        uint128 oldValidatorId,
        uint128 newValidatorId,
        uint128 unstakingId
    ) external {
        require(oldValidatorId < validatorsN, "Invalid validator");
        require(_validators[oldValidatorId].disabledAtBlock != 0, "Validator is not disabled");
        require(_validators[oldValidatorId]._address != msg.sender, "Validator cannot redelegate");
        require(_validators[oldValidatorId].unstakings[msg.sender].length > unstakingId, "Unstaking does not exist");
        Unstaking storage us = _validators[oldValidatorId].unstakings[msg.sender][unstakingId];
        require(us.amount >= amount, "Unstaking has less tokens");
        // stake tokens back to the contract using new validator, set withTransfer to false since the tokens are already in the contract
        _stake(newValidatorId, amount, false);
        unchecked {
            us.amount -= amount;
        }
        // set cool down end to 0 to release gas if new unstaking amount is 0
        if (us.amount == 0) us.coolDownEnd = 0;
        emit Redelegated(oldValidatorId, newValidatorId, msg.sender, amount, unstakingId);
    }

    /*
     * Changes the validator staking address
     */
    function setValidatorAddress(uint128 validatorId, address newAddress) external {
        Validator storage v = _validators[validatorId];
        require(msg.sender == v._address, "Sender is not the validator");
        require(newAddress != address(0), "Invalid validator address");

        v.stakings[newAddress].shares += v.stakings[msg.sender].shares;
        v.stakings[newAddress].staked += v.stakings[msg.sender].staked;
        delete v.stakings[msg.sender];

        for (uint i = 0; i < v.unstakings[msg.sender].length; i++) {
            v.unstakings[newAddress].push(v.unstakings[msg.sender][i]);
        }
        delete v.unstakings[msg.sender];

        v._address = newAddress;
        emit ValidatorAddressChanged(validatorId, newAddress);
    }

    /*
     * Gets metadata
     */
    function getMetadata()
        external
        view
        returns (
            address CQTaddress,
            address _stakingManager,
            uint128 _validatorsN,
            uint128 _rewardPool,
            uint128 _validatorCoolDown,
            uint128 _delegatorCoolDown,
            uint128 _maxCapMultiplier,
            uint128 _validatorMaxStake
        )
    {
        return (address(CQT), stakingManager, validatorsN, rewardPool, validatorCoolDown, delegatorCoolDown, maxCapMultiplier, validatorMaxStake);
    }

    /*
     * Returns validator metadata with how many tokens were staked and delegated excluding compounded rewards
     */
    function getValidatorMetadata(uint128 validatorId)
        public
        view
        returns (
            address _address,
            uint128 staked,
            uint128 delegated,
            uint128 commissionRate,
            uint256 disabledAtBlock
        )
    {
        Validator storage v = _validators[validatorId];
        return (v._address, v.stakings[v._address].staked, v.delegated, v.commissionRate, v.disabledAtBlock);
    }

    /*
     * Returns metadata for each validator
     */
    function getAllValidatorsMetadata()
        external
        view
        returns (
            address[] memory addresses,
            uint128[] memory staked,
            uint128[] memory delegated,
            uint128[] memory commissionRates,
            uint256[] memory disabledAtBlocks
        )
    {
        return getValidatorsMetadata(0, validatorsN);
    }

    /*
     * Returns metadata for validators whose ids are between startId and endId exclusively
     */
    function getValidatorsMetadata(uint128 startId, uint128 endId)
        public
        view
        returns (
            address[] memory addresses,
            uint128[] memory staked,
            uint128[] memory delegated,
            uint128[] memory commissionRates,
            uint256[] memory disabledAtBlocks
        )
    {
        require(endId <= validatorsN, "Invalid end id");
        require(startId < endId, "Start id must be less than end id");

        uint128 n = endId - startId;
        addresses = new address[](n);
        staked = new uint128[](n);
        delegated = new uint128[](n);
        commissionRates = new uint128[](n);
        disabledAtBlocks = new uint256[](n);

        uint128 i;
        for (uint128 id = startId; id < endId; ++id) {
            i = id - startId;
            (addresses[i], staked[i], delegated[i], commissionRates[i], disabledAtBlocks[i]) = getValidatorMetadata(id);
        }
        return (addresses, staked, delegated, commissionRates, disabledAtBlocks);
    }

    /*
     * Returns validator staked and delegated token amounts, excluding compounded rewards
     */
    function getValidatorStakingData(uint128 validatorId) external view returns (uint128 staked, uint128 delegated) {
        Validator storage v = _validators[validatorId];
        return (v.stakings[v._address].staked, v.delegated);
    }

    /*
     * Returns validator staked and delegated token amounts, including compounded rewards
     * This function will be called by StakingManager at the beginning of each checkpoint
     */
    function getValidatorCompoundedStakingData(uint128 validatorId) external view returns (uint128 staked, uint128 delegated) {
        Validator storage v = _validators[validatorId];
        // this includes staked + compounded rewards
        staked = _sharesToTokens(v.stakings[v._address].shares, v.exchangeRate);
        // this includes delegated + compounded rewards
        delegated = _sharesToTokens(v.totalShares, v.exchangeRate) - staked;
        return (staked, delegated);
    }

    /*
     * Returns the amount that's staked, earned by delegator plus unstaking information.
     * CommissionEarned is for validators
     */
    function getDelegatorMetadata(address delegator, uint128 validatorId)
        external
        view
        returns (
            uint128 staked,
            uint128 rewards,
            uint128 commissionEarned,
            uint128[] memory unstakingAmounts,
            uint128[] memory unstakingsEndEpochs
        )
    {
        Validator storage v = _validators[validatorId];
        Staking storage s = v.stakings[delegator];
        staked = s.staked;
        uint128 sharesValue = _sharesToTokens(s.shares, v.exchangeRate);
        if (sharesValue <= s.staked) rewards = 0;
        else rewards = sharesValue - s.staked;
        // if requested delegator is the requested validator
        if (v._address == delegator) commissionEarned = v.commissionAvailableToRedeem;
        Unstaking[] memory unstakings = v.unstakings[delegator];
        uint256 unstakingsN = unstakings.length;
        unstakingAmounts = new uint128[](unstakingsN);
        unstakingsEndEpochs = new uint128[](unstakingsN);
        for (uint256 i = 0; i < unstakingsN; i++) {
            unstakingAmounts[i] = unstakings[i].amount;
            unstakingsEndEpochs[i] = unstakings[i].coolDownEnd;
        }
        return (staked, rewards, commissionEarned, unstakingAmounts, unstakingsEndEpochs);
    }
}