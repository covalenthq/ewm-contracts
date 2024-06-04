//SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract OperationalStaking is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public constant DIVIDER = 10 ** 18; // 18 decimals used for scaling rates
    uint128 public constant REWARD_REDEEM_THRESHOLD = 10 ** 8; // minimum number of tokens that can be redeemed
    uint128 public constant DEFAULT_VALIDATOR_ENABLE_MIN_STAKE = 35000 * 10 ** 18; // minimum number of self-staked tokens for a validator to become / stay enabled
    uint128 public constant DEFAULT_DELEGATOR_MIN_STAKE = 10 ** 18; // stake/unstake operations are invalid if they put you below this threshold (except unstaking to 0)

    IERC20Upgradeable public CQT;
    uint128 public rewardPool; // how many tokens are allocated for rewards
    uint128 public validatorCoolDown; // how many blocks until validator unstaking is unlocked
    uint128 public delegatorCoolDown; // how many blocks until delegator unstaking is unlocked
    uint128 public recoverUnstakingCoolDown; //how many blocks until delegator recoverUnstaking or redelegateUnstaked is unlocked
    uint128 public maxCapMultiplier; // *see readme
    uint128 public validatorMaxStake; // how many tokens validators can stake at most
    address public stakingManager;
    uint128 public validatorsN; // number of validators, used to get validator ids
    mapping(uint128 => Validator) internal _validators; // id -> validator instance

    uint128 public validatorEnableMinStake; // minimum number of self-staked tokens for a validator to become / stay enabled
    uint128 public delegatorMinStake; // stake/unstake operations are invalid if they put you below this threshold (except unstaking to 0)

    bool private _unpaused;

    struct Staking {
        uint128 shares; // # of validator shares that the delegator owns
        uint128 staked; // # of CQT that a delegator delegated originally through stake() transaction
    }

    struct Unstaking {
        uint128 outCoolDownEnd; // epoch when unstaking can be redeemed (taken out)
        uint128 recoverCoolDownEnd; // epoch when unstaking can be recovered (to the same validator) or redelegated
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
        bool frozen;
    }

    event InitializedSemantics(
        address cqt,
        uint128 validatorCoolDown,
        uint128 delegatorCoolDown,
        uint128 recoverUnstakingCoolDown,
        uint128 maxCapMultiplier,
        uint128 validatorMaxStake,
        uint128 validatorEnableMinStake,
        uint128 delegatorMinStake
    );

    event RewardTokensDeposited(uint128 amount);

    event ValidatorAdded(uint128 indexed id, uint128 commissionRate, address indexed validator);

    event Staked(uint128 indexed validatorId, address delegator, uint128 amount);

    event Unstaked(uint128 indexed validatorId, address indexed delegator, uint128 amount, uint128 unstakeId);

    event RecoveredUnstake(uint128 indexed validatorId, address indexed delegator, uint128 amount, uint128 unstakingId);

    event UnstakeRedeemed(uint128 indexed validatorId, address indexed delegator, uint128 indexed unstakeId, uint128 amount);

    event AllocatedTokensTaken(uint128 amount);

    event RewardFailedDueZeroStake(uint128 indexed validatorId, uint128 amount);

    event RewardFailedDueValidatorDisabled(uint128 indexed validatorId, uint128 amount);

    event RewardFailedDueValidatorFrozen(uint128 indexed validatorId, uint128 amount);

    event RewardRedeemed(uint128 indexed validatorId, address indexed beneficiary, uint128 amount);

    event CommissionRewardRedeemed(uint128 indexed validatorId, address indexed beneficiary, uint128 amount);

    event StakingManagerChanged(address indexed operationalManager);

    event ValidatorCommissionRateChanged(uint128 indexed validatorId, uint128 amount);

    event ValidatorMaxCapChanged(uint128 amount);

    event ValidatorEnableMinStakeChanged(uint128 amount);

    event DelegatorMinStakeChanged(uint128 amount);

    event ValidatorUnstakeCooldownChanged(uint128 amount);

    event DelegatorUnstakeCooldownChanged(uint128 amount);

    event RecoverUnstakeCooldownChanged(uint128 amount);

    event ValidatorDisabled(uint128 indexed validatorId, uint256 blockNumber);

    event Redelegated(uint128 indexed oldValidatorId, uint128 indexed newValidatorId, address indexed delegator, uint128 amount, uint128 unstakingId);

    event MaxCapMultiplierChanged(uint128 newMaxCapMultiplier);

    event ValidatorEnabled(uint128 indexed validatorId);

    event ValidatorAddressChanged(uint128 indexed validatorId, address indexed newAddress);

    event Paused(address account);

    event Unpaused(address account);

    event ValidatorFrozen(uint128 indexed validatorId, string reason);

    event ValidatorUnfrozen(uint128 indexed validatorId);

    event RewardsDisbursed(uint128 indexed rewardId);

    modifier onlyStakingManager() {
        require(stakingManager == msg.sender, "Caller is not stakingManager");
        _;
    }

    modifier onlyStakingManagerOrOwner() {
        require(msg.sender == stakingManager || msg.sender == owner(), "Caller is not stakingManager or owner");
        _;
    }

    modifier whenNotPaused() {
        require(_unpaused, "paused");
        _;
    }

    function initialize(address cqt, uint128 dCoolDown, uint128 vCoolDown, uint128 rCoolDown, uint128 maxCapM, uint128 vMaxStake) external initializer {
        require(cqt != address(0), "Invalid cqt address");
        __Ownable_init();
        validatorCoolDown = vCoolDown; // 180*6857 = ~ 6 months
        delegatorCoolDown = dCoolDown; //  28*6857 = ~ 28 days
        recoverUnstakingCoolDown = rCoolDown; // 3*6857 = ~ 3 days
        maxCapMultiplier = maxCapM;
        validatorMaxStake = vMaxStake;
        require(validatorMaxStake >= DEFAULT_VALIDATOR_ENABLE_MIN_STAKE);

        validatorEnableMinStake = DEFAULT_VALIDATOR_ENABLE_MIN_STAKE;
        delegatorMinStake = DEFAULT_DELEGATOR_MIN_STAKE;

        _unpaused = true;

        CQT = IERC20Upgradeable(cqt);
        emit InitializedSemantics(cqt, vCoolDown, dCoolDown, rCoolDown, maxCapM, vMaxStake, validatorEnableMinStake, delegatorMinStake);
    }

    function setStakingManagerAddress(address newAddress) external onlyOwner {
        require(newAddress != address(0), "Invalid address");
        stakingManager = newAddress;
        emit StakingManagerChanged(newAddress);
    }

    /*
     * Transfer CQT from the owner to the contract for reward allocation
     */
    function depositRewardTokens(uint128 amount) external onlyOwner {
        require(amount > 0, "Amount is 0");
        rewardPool += amount;
        _transferToContract(msg.sender, amount);
        emit RewardTokensDeposited(amount);
    }

    /*
     * Transfer reward CQT from the contract to the owner
     */
    function takeOutRewardTokens(uint128 amount) external onlyOwner {
        require(amount > 0, "Amount is 0");
        require(amount <= rewardPool, "Reward pool is too small");
        rewardPool -= amount;
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
        require(maxStake >= validatorEnableMinStake, "maxStake should be greater than validatorEnableMinStake");
        validatorMaxStake = maxStake;
        emit ValidatorMaxCapChanged(maxStake);
    }

    /*
     * Updates minimum number of tokens that a validator must self-stake before enabling
     */
    function setValidatorEnableMinStake(uint128 minStake) public onlyOwner {
        require(minStake <= validatorMaxStake, "minStake cannot be greater than validatorMaxStake");
        validatorEnableMinStake = minStake;
        emit ValidatorEnableMinStakeChanged(minStake);
    }

    /*
     * Updates minimum valid position threshold for per-delegator stake
     */
    function setDelegatorMinStake(uint128 minStake) public onlyOwner {
        require(minStake <= validatorMaxStake, "minStake cannot be greater than validatorMaxStake");
        delegatorMinStake = minStake;
        emit DelegatorMinStakeChanged(minStake);
    }

    /*
     * Updates the validator cool down period (in blocks)
     * Note: this doesn't effect the existing unstakes
     */
    function setValidatorCoolDown(uint128 coolDown) external onlyOwner {
        validatorCoolDown = coolDown;
        emit ValidatorUnstakeCooldownChanged(coolDown);
    }

    /*
     * Updates the delegator cool down period (in blocks)
     * Note: this doesn't effect the existing unstakes
     */
    function setDelegatorCoolDown(uint128 coolDown) external onlyOwner {
        delegatorCoolDown = coolDown;
        emit DelegatorUnstakeCooldownChanged(coolDown);
    }

    /*
     * Updates the delegator recover Unstaking cool down period (in blocks)
     * Note: this doesn't effect the existing unstakes
     */
    function setRecoverUnstakingCoolDown(uint128 coolDown) external onlyOwner {
        recoverUnstakingCoolDown = coolDown;
        emit RecoverUnstakeCooldownChanged(coolDown);
    }

    /*
     * Adds new validator instance
     */
    function addValidator(address validator, uint128 commissionRate) external onlyOwner whenNotPaused returns (uint256 id) {
        require(commissionRate < DIVIDER, "Rate must be less than 100%");
        require(validator != address(0), "Validator address is 0");
        require(validatorsN < 256, "Too many validators");
        Validator storage v = _validators[validatorsN]; // use current number of validators for the id of a new validator instance
        v._address = validator;
        v.exchangeRate = uint128(DIVIDER); // make it 1:1 initially
        v.commissionRate = commissionRate;
        v.disabledAtBlock = 1; // set it to 1 to indicate that the validator is disabled

        emit ValidatorAdded(validatorsN, commissionRate, validator);
        validatorsN += 1;

        return validatorsN - 1;
    }

    /*
     * Reward emission
     */
    function rewardValidators(uint128 rewardId, uint128[] calldata ids, uint128[] calldata amounts) external onlyStakingManager whenNotPaused {
        require(ids.length == amounts.length, "Given ids and amounts arrays must be of the same length");
        uint128 newRewardPool = rewardPool;
        uint128 amount;
        uint128 validatorId;
        uint128 commissionPaid;

        for (uint256 j = 0; j < ids.length; j++) {
            amount = amounts[j];
            validatorId = ids[j];
            // ensure each validator exists
            require(validatorId < validatorsN, "Invalid validatorId");

            // make sure there are enough tokens in the reward pool
            require(newRewardPool >= amount, "Reward pool is too small");

            Validator storage v = _validators[validatorId];

            if (v.frozen) {
                emit RewardFailedDueValidatorFrozen(validatorId, amount);
                continue;
            }

            if (v.disabledAtBlock != 0) {
                // validator became disabled (due to e.g. unstaking past base stake)
                // between proof submission and finalization
                emit RewardFailedDueValidatorDisabled(validatorId, amount);
                continue;
            }

            if (v.totalShares == 0) {
                // mathematically undefined -- no exchangeRate can turn zero into nonzero
                // (this condition is only possible in testing with minValidatorEnableStake == 0;
                //  in prod, validators with zero stake will always be disabled and so will trigger
                //  the above check, not this one)
                emit RewardFailedDueZeroStake(validatorId, amount);
                continue;
            }

            commissionPaid = uint128((uint256(amount) * uint256(v.commissionRate)) / DIVIDER);

            // distribute the tokens by increasing the exchange rate
            // div by zero impossible due to check above
            // (and in fact, presuming minValidatorEnableStake >= DIVIDER, v.totalShares will
            //  always be >= DIVIDER while validator is enabled)
            v.exchangeRate += uint128((uint256(amount - commissionPaid) * uint256(DIVIDER)) / v.totalShares);

            // commission is not compounded
            // commisison is distributed under the validator instance
            v.commissionAvailableToRedeem += commissionPaid;

            newRewardPool -= amount;
        }

        rewardPool = newRewardPool; // can never access these tokens anymore, reserved for validator rewards
        emit RewardsDisbursed(rewardId);
    }

    /*
     * Disables validator instance starting from the given block
     */
    function disableValidator(uint128 validatorId) external onlyStakingManagerOrOwner {
        require(validatorId < validatorsN, "Invalid validator");
        Validator storage v = _validators[validatorId];

        if (v.disabledAtBlock != 0) {
            // silently succeed
            return;
        }

        v.disabledAtBlock = block.number;
        emit ValidatorDisabled(validatorId, block.number);
    }

    /*
     * Enables validator instance by setting the disabledAtBlock to 0
     */
    function enableValidator(uint128 validatorId) external onlyStakingManagerOrOwner {
        require(validatorId < validatorsN, "Invalid validator");
        Validator storage v = _validators[validatorId];

        if (v.disabledAtBlock == 0) {
            // silently succeed
            return;
        }

        uint128 staked = _sharesToTokens(v.stakings[v._address].shares, v.exchangeRate);
        require(staked >= validatorEnableMinStake, "Validator is insufficiently staked");

        v.disabledAtBlock = 0;
        emit ValidatorEnabled(validatorId);
    }

    /*
     * Determines whether a validator is currently able to be used by operators
     */
    function isValidatorEnabled(uint128 validatorId) external view returns (bool) {
        require(validatorId < validatorsN, "Invalid validator");
        return _validators[validatorId].disabledAtBlock == 0;
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
        return uint128((uint256(amount) * DIVIDER) / uint256(rate)); // Rounding down from uint256 to uint128 leading to loss of precision for which checks are implemented in _redeemRewards and _unstake
    }

    /*
     * Delegates tokens under the provided validator
     */
    function stake(uint128 validatorId, uint128 amount) external whenNotPaused {
        _stake(validatorId, amount, true);
    }

    /*
     * withTransfer is set to false when delegators recover unstaked or redelegated tokens.
     * These tokens are already in the contract.
     */
    function _stake(uint128 validatorId, uint128 amount, bool withTransfer) internal {
        require(validatorId < validatorsN, "Invalid validator");
        require(amount >= DEFAULT_DELEGATOR_MIN_STAKE, "Stake amount is too small");
        Validator storage v = _validators[validatorId];
        bool isValidator = msg.sender == v._address;

        require(!v.frozen, "Validator is frozen");

        // validators should be able to stake if they are disabled.
        if (!isValidator) require(v.disabledAtBlock == 0, "Validator is disabled");

        Staking storage s = v.stakings[msg.sender];

        uint128 newStaked = s.staked + amount;

        require(newStaked >= delegatorMinStake, "Cannot stake to a position less than delegatorMinStake");

        uint128 sharesAdd = _tokensToShares(amount, v.exchangeRate);

        if (isValidator) {
            // compares with newStaked to ignore compounded rewards
            require(newStaked <= validatorMaxStake, "Validator max stake exceeded");
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
        s.staked = newStaked;
        if (withTransfer) _transferToContract(msg.sender, amount);
        emit Staked(validatorId, msg.sender, amount);
    }

    /*
     * Undelegates all staked tokens from the provided validator
     */
    function unstakeAll(uint128 validatorId) external whenNotPaused {
        _unstake(validatorId, 0); // pass 0 to request full amount
    }

    /*
     * Undelegates some number of tokens from the provided validator
     */
    function unstake(uint128 validatorId, uint128 amount) external whenNotPaused {
        require(amount > 0, "Amount is 0");
        _unstake(validatorId, amount);
    }

    /*
     * Undelegates tokens from the provided validator
     */
    function _unstake(uint128 validatorId, uint128 amount) internal {
        require(validatorId < validatorsN, "Invalid validator");

        Validator storage v = _validators[validatorId];
        Staking storage s = v.stakings[msg.sender];
        if (msg.sender == v._address) {
            require(!v.frozen, "Validator is frozen");
        }

        require(amount <= s.staked, "Cannot unstake amount greater than current stake");

        bool isUnstakingAll = amount == 0 || amount == s.staked;
        uint128 effectiveAmount = isUnstakingAll ? s.staked : amount;
        uint128 newStaked = s.staked - effectiveAmount;

        if (isUnstakingAll) {
            // enforce precondition for later math that effectiveAmount is always nonzero
            require(effectiveAmount > 0, "Already fully unstaked");
        } else {
            // to prevent buildup of Unstaking[] elements, do not allow user to repeatedly unstake trivial amounts
            // (but do allow removal of a trivial amount if it is the entire remaining stake)
            require(effectiveAmount >= REWARD_REDEEM_THRESHOLD, "Unstake amount is too small");

            // to prevent "spam" delegations, and runaway exchangeRate inflation from all-but-dust self-stake unstaking,
            // disallow unstaking that would result in a new stake below delegatorMinStake
            // (with the exception of an unstaking that takes the stake exactly to zero)
            require(newStaked >= delegatorMinStake, "Cannot unstake to a position below delegatorMinStake (except to zero)");
        }

        bool isValidator = msg.sender == v._address;

        // disable validator if they unstaked to below their required self-stake
        if (isValidator && validatorEnableMinStake > 0 && v.disabledAtBlock == 0 && newStaked < validatorEnableMinStake) {
            uint256 disabledAtBlock = block.number;
            v.disabledAtBlock = disabledAtBlock;
            emit ValidatorDisabled(validatorId, disabledAtBlock);
        }

        if (isValidator && v.disabledAtBlock == 0) {
            // validators will have to disable themselves if they want to unstake tokens below delegation max cap
            uint128 newValidatorMaxCap = newStaked * maxCapMultiplier;
            require(v.delegated <= newValidatorMaxCap, "Cannot decrease delegation max-cap below current delegation while validator is enabled");
        }
        if (!isValidator) {
            v.delegated -= effectiveAmount;
        }

        uint128 sharesToRemove = _tokensToShares(effectiveAmount, v.exchangeRate);

        // sometimes, due to conversion inconsistencies, sharesToRemove might end up larger than s.shares;
        // so we clamp sharesToRemove to s.shares (the redeemer unstakes trivially more tokens in this case)
        if (sharesToRemove > s.shares) sharesToRemove = s.shares;

        // sanity check: sharesToRemove should never be zero while amount is nonzero, as this would enable
        // infinite draining of funds
        require(sharesToRemove > 0, "Underflow error");

        if (uint256(sharesToRemove) * uint256(v.exchangeRate) < uint256(effectiveAmount) * uint256(DIVIDER)) {
            effectiveAmount = uint128((uint256(sharesToRemove) * uint256(v.exchangeRate)) / uint256(DIVIDER));
        }
        s.shares -= sharesToRemove;
        v.totalShares -= sharesToRemove;
        // remove staked tokens
        s.staked = newStaked;

        // create unstaking instance
        uint128 outCoolDownEnd = uint128(v.disabledAtBlock != 0 ? v.disabledAtBlock : block.number);
        uint128 recoverCoolDownEnd = outCoolDownEnd + recoverUnstakingCoolDown;
        outCoolDownEnd += (isValidator ? validatorCoolDown : delegatorCoolDown);
        uint128 unstakeId = uint128(v.unstakings[msg.sender].length);
        v.unstakings[msg.sender].push(Unstaking(outCoolDownEnd, recoverCoolDownEnd, effectiveAmount));
        emit Unstaked(validatorId, msg.sender, effectiveAmount, unstakeId);
    }

    /*
     * Restakes unstaked tokens (with the same validator)
     */
    function recoverUnstaking(uint128 amount, uint128 validatorId, uint128 unstakingId) external whenNotPaused {
        Validator storage v = _validators[validatorId];
        require(amount > 0, "Amount is 0");
        require(validatorId < validatorsN, "Invalid validator");
        require(!v.frozen, "Validator is frozen");
        require(_validators[validatorId].unstakings[msg.sender].length > unstakingId, "Unstaking does not exist");
        Unstaking storage us = _validators[validatorId].unstakings[msg.sender][unstakingId];
        require(us.amount >= amount, "Unstaking has less tokens");
        require(block.number > us.recoverCoolDownEnd, "recover cooldown not over");

        us.amount -= amount;
        // set cool down end to 0 to release gas if new unstaking amount is 0
        if (us.amount == 0) {
            us.recoverCoolDownEnd = 0;
            us.outCoolDownEnd = 0;
        }
        emit RecoveredUnstake(validatorId, msg.sender, amount, unstakingId);
        _stake(validatorId, amount, false);
    }

    /*
     * Transfers out unlocked unstaked tokens back to the delegator
     */
    function transferUnstakedOut(uint128 amount, uint128 validatorId, uint128 unstakingId) external whenNotPaused {
        Validator storage v = _validators[validatorId];
        require(amount > 0, "Amount is 0");
        require(validatorId < validatorsN, "Invalid validator");
        require(!v.frozen, "Validator is frozen");
        require(_validators[validatorId].unstakings[msg.sender].length > unstakingId, "Unstaking does not exist");
        Unstaking storage us = _validators[validatorId].unstakings[msg.sender][unstakingId];
        require(block.number > us.outCoolDownEnd, "Cooldown period has not ended");
        require(us.amount >= amount, "Amount is too high");
        us.amount -= amount;
        // set cool down end to 0 to release gas if new unstaking amount is 0
        if (us.amount == 0) {
            us.recoverCoolDownEnd = 0;
            us.outCoolDownEnd = 0;
        }
        emit UnstakeRedeemed(validatorId, msg.sender, unstakingId, amount);
        _transferFromContract(msg.sender, amount);
    }

    /*
     * Redeems all available rewards
     */
    function redeemAllRewards(uint128 validatorId, address beneficiary) external whenNotPaused {
        _redeemRewards(validatorId, beneficiary, 0); // pass 0 to request full amount
    }

    /*
     * Redeems partial rewards
     */
    function redeemRewards(uint128 validatorId, address beneficiary, uint128 amount) external whenNotPaused {
        require(amount > 0, "Amount is 0");
        _redeemRewards(validatorId, beneficiary, amount);
    }

    function _redeemRewards(uint128 validatorId, address beneficiary, uint128 amount) internal {
        require(validatorId < validatorsN, "Invalid validator");
        require(beneficiary != address(0x0), "Invalid beneficiary");
        Validator storage v = _validators[validatorId];
        Staking storage s = v.stakings[msg.sender];

        require(!v.frozen, "Validator is frozen");

        // how many tokens a delegator/validator has in total on the contract
        // include earned commission if the delegator is the validator
        uint128 totalValue = _sharesToTokens(s.shares, v.exchangeRate);

        // how many tokens a delegator/validator has "unlocked", free to be redeemed
        // (i.e. not staked or in unstaking cooldown)
        uint128 totalUnlockedValue = (totalValue < s.staked) ? 0 : (totalValue - s.staked);

        bool isRedeemingAll = (amount == 0 || amount == totalUnlockedValue); // amount is 0 when it's requested to redeem all rewards

        // make sure rewards exist
        // (note that this still works in the case where we're redeeming all! always doing this check saves a branch op)
        require(amount <= totalUnlockedValue, "Cannot redeem amount greater than held, unstaked rewards");

        uint128 effectiveAmount = isRedeemingAll ? totalUnlockedValue : amount;

        // can only redeem above redeem threshold
        require(effectiveAmount >= REWARD_REDEEM_THRESHOLD, "Requested amount must be higher than redeem threshold");
        // make sure rewardPool has funds to cover effective amount before transfer
        require(rewardPool >= effectiveAmount, "Requested amount is not available in the staking contract reward pool");

        uint128 sharesToBurn = _tokensToShares(effectiveAmount, v.exchangeRate);

        // sometimes, due to conversion inconsistencies, sharesToBurn might end up larger than s.shares;
        // so we clamp sharesToBurn to s.shares (the redeemer gets trivially more value out in this case)
        if (sharesToBurn > s.shares) sharesToBurn = s.shares;

        // sanity check: sharesToBurn should never be zero while effectiveAmount is nonzero, as this
        // would enable infinite draining of funds
        require(sharesToBurn > 0, "Underflow error");
        if (uint256(sharesToBurn) * uint256(v.exchangeRate) < uint256(effectiveAmount) * uint256(DIVIDER)) {
            effectiveAmount = uint128((uint256(sharesToBurn) * uint256(v.exchangeRate)) / uint256(DIVIDER));
        }
        v.totalShares -= sharesToBurn;
        s.shares -= sharesToBurn;

        emit RewardRedeemed(validatorId, beneficiary, effectiveAmount);
        _transferFromContract(beneficiary, effectiveAmount);
    }

    function redeemCommission(uint128 validatorId, address beneficiary, uint128 amount) public whenNotPaused {
        require(validatorId < validatorsN, "Invalid validator");
        require(beneficiary != address(0x0), "Invalid beneficiary");
        Validator storage v = _validators[validatorId];
        require(v._address == msg.sender, "The sender is not the validator");

        require(!v.frozen, "Validator is frozen");

        require(v.commissionAvailableToRedeem > 0, "No commission available to redeem");
        require(amount > 0, "The requested amount is 0");
        require(amount <= v.commissionAvailableToRedeem, "Requested amount is higher than commission available to redeem");
        // make sure rewardPool has funds to cover effective amount before transfer
        require(rewardPool >= amount, "Requested amount is not available in the staking contract reward pool");
        v.commissionAvailableToRedeem -= amount;

        _transferFromContract(beneficiary, amount);
        emit CommissionRewardRedeemed(validatorId, beneficiary, amount);
    }

    function redeemAllCommission(uint128 validatorId, address beneficiary) external whenNotPaused {
        redeemCommission(validatorId, beneficiary, _validators[validatorId].commissionAvailableToRedeem);
    }

    /*
     * Redelegates tokens to another validator if a validator got disabled.
     * First the tokens need to be unstaked
     */
    function redelegateUnstaked(uint128 amount, uint128 oldValidatorId, uint128 newValidatorId, uint128 unstakingId) external whenNotPaused {
        require(oldValidatorId < validatorsN, "Invalid validator");
        require(oldValidatorId != newValidatorId, "Old and new validators are the same");
        require(amount > 0, "Amount is 0");
        Validator storage vOld = _validators[oldValidatorId];
        Validator storage vNew = _validators[newValidatorId];
        // new staking should not be from same an address to same (new) validator to bypass cooldown
        require(vNew._address != msg.sender, "New Validator cannot be same as sender");
        // assets of delegators cannot be moved to a frozen validator
        require(!vNew.frozen, "Target validator is frozen");
        // assets of delegators cannot be moved to a disabled validator
        require(vNew.disabledAtBlock == 0, "Target validator is disabled");
        // assets of delegators cannot be moved while validator is frozen
        require(!vOld.frozen, "Validator is frozen");
        require(vOld.disabledAtBlock != 0, "Validator is not disabled");
        require(vOld._address != msg.sender, "Validator cannot redelegate");
        require(vOld.unstakings[msg.sender].length > unstakingId, "Unstaking does not exist");
        Unstaking storage us = vOld.unstakings[msg.sender][unstakingId];
        require(us.amount >= amount, "Unstaking has less tokens");
        require(block.number > us.recoverCoolDownEnd, "recover cooldown not over");

        // stake tokens back to the contract using new validator, set withTransfer to false since the tokens are already in the contract
        us.amount -= amount;

        // set cool down end to 0 to release gas if new unstaking amount is 0
        if (us.amount == 0) {
            us.recoverCoolDownEnd = 0;
            us.outCoolDownEnd = 0;
        }
        emit Redelegated(oldValidatorId, newValidatorId, msg.sender, amount, unstakingId);
        _stake(newValidatorId, amount, false);
    }

    /*
     * Changes the validator staking address, this will transfer validator staking data and optionally unstakings
     */
    function setValidatorAddress(uint128 validatorId, address newAddress) external whenNotPaused {
        Validator storage v = _validators[validatorId];
        // Check if the sender is the validator
        require(msg.sender == v._address, "Sender is not the validator");
        // Check if the new address is different from the current address
        require(newAddress != v._address, "The new address cannot be equal to the current validator address");
        require(newAddress != address(0), "Invalid validator address");
        // Check if the validatorId exists and is not frozen
        require(!v.frozen, "Validator is already frozen");

        // Check if the newAddress is already present as validator or delegator in the system
        require(!checkDelegatorExists(newAddress), "newAddress must not already exist in the system");

        // Transfer shares and staked amount from sender to the new address
        v.stakings[newAddress].shares += v.stakings[msg.sender].shares;
        v.stakings[newAddress].staked += v.stakings[msg.sender].staked;
        // New addresses total stake shold not exceed validatorMaxStake
        require(v.stakings[newAddress].staked <= validatorMaxStake, "Validator max stake exceeded");
        // Remove stakings of the sender
        delete v.stakings[msg.sender];
        // Transfer unstakings from sender to new address
        Unstaking[] storage oldUnstakings = v.unstakings[msg.sender];
        uint256 length = oldUnstakings.length;
        require(length <= 300, "Cannot transfer more than 300 unstakings");
        Unstaking[] storage newUnstakings = v.unstakings[newAddress];
        for (uint128 i = 0; i < length; ++i) {
            newUnstakings.push(oldUnstakings[i]);
        }
        // Remove unstakings of the sender
        delete v.unstakings[msg.sender];

        // Update validator address
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
            uint128 _recoverUnstakingCoolDown,
            uint128 _maxCapMultiplier,
            uint128 _validatorMaxStake,
            uint128 _validatorEnableMinStake,
            uint128 _delegatorMinStake
        )
    {
        return (
            address(CQT),
            stakingManager,
            validatorsN,
            rewardPool,
            validatorCoolDown,
            delegatorCoolDown,
            recoverUnstakingCoolDown,
            maxCapMultiplier,
            validatorMaxStake,
            validatorEnableMinStake,
            delegatorMinStake
        );
    }

    /*
     * Returns validator metadata with how many tokens were staked and delegated excluding compounded rewards
     */
    function getValidatorMetadata(uint128 validatorId) public view returns (address _address, uint128 staked, uint128 delegated, uint128 commissionRate, uint256 disabledAtBlock) {
        require(validatorId < validatorsN, "Invalid validator");
        Validator storage v = _validators[validatorId];
        return (v._address, v.stakings[v._address].staked, v.delegated, v.commissionRate, v.disabledAtBlock);
    }

    /*
     * Returns metadata for each validator
     */
    function getAllValidatorsMetadata()
        external
        view
        returns (address[] memory addresses, uint128[] memory staked, uint128[] memory delegated, uint128[] memory commissionRates, uint256[] memory disabledAtBlocks)
    {
        return getValidatorsMetadata(0, validatorsN);
    }

    /*
     * Returns metadata for validators whose ids are between startId and endId exclusively
     */
    function getValidatorsMetadata(
        uint128 startId,
        uint128 endId
    ) public view returns (address[] memory addresses, uint128[] memory staked, uint128[] memory delegated, uint128[] memory commissionRates, uint256[] memory disabledAtBlocks) {
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
        require(validatorId < validatorsN, "Invalid validator");
        Validator storage v = _validators[validatorId];
        return (v.stakings[v._address].staked, v.delegated);
    }

    /*
     * Returns validator staked and delegated token amounts, including compounded rewards
     */
    function getValidatorsCompoundedStakes() external view returns (uint128[] memory validatorIds, bool[] memory isEnableds, uint128[] memory cstaked) {
        validatorIds = new uint128[](validatorsN);
        isEnableds = new bool[](validatorsN);
        cstaked = new uint128[](validatorsN);
        for (uint128 i = 0; i < validatorsN; i++) {
            Validator storage v = _validators[i];
            validatorIds[i] = i;
            isEnableds[i] = v.disabledAtBlock == 0;
            cstaked[i] = _sharesToTokens(v.stakings[v._address].shares, v.exchangeRate);
        }

        return (validatorIds, isEnableds, cstaked);
    }

    /*
     * Returns validator staked and delegated token amounts, including compounded rewards
     */
    function getValidatorCompoundedStakingData(uint128 validatorId) external view returns (uint128 staked, uint128 delegated) {
        require(validatorId < validatorsN, "Invalid validator");
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
    function getDelegatorMetadata(
        address delegator,
        uint128 validatorId
    ) external view returns (uint128 staked, uint128 rewards, uint128 commissionEarned, uint128[] memory unstakingAmounts, uint128[] memory unstakingsEndEpochs) {
        require(validatorId < validatorsN, "Invalid validator");
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
            unstakingsEndEpochs[i] = unstakings[i].outCoolDownEnd;
        }
        return (staked, rewards, commissionEarned, unstakingAmounts, unstakingsEndEpochs);
    }

    // function getDelegatorMetadataPaginated(
    //     address delegator,
    //     uint128 validatorId,
    //     uint128 start,
    //     uint128 end
    // )
    //     external
    //     view
    //     returns (uint128[] memory staked, uint128[] memory rewards, uint128[] memory commissionEarned, uint128[] memory unstakingAmounts, uint128[] memory unstakingsEndEpochs)
    // {
    //     require(validatorId < validatorsN, "Invalid validator");
    //     Validator storage v = _validators[validatorId];
    //     Staking storage s = v.stakings[delegator];
    //     staked = new uint128[](end - start + 1);
    //     rewards = new uint128[](end - start + 1);
    //     commissionEarned = new uint128[](end - start + 1);
    //     unstakingAmounts = new uint128[](end - start + 1);
    //     unstakingsEndEpochs = new uint128[](end - start + 1);

    //     for (uint256 i = start; i <= end; i++) {
    //         Unstaking memory u = v.unstakings[delegator][i];
    //         staked[i - start] = s.shares[u.shareIndex];
    //         if (s.shares[u.shareIndex] <= _sharesToTokens(s.shares[u.shareIndex], v.exchangeRate)) {
    //             rewards[i - start] = 0;
    //         } else {
    //             rewards[i - start] = _sharesToTokens(s.shares[u.shareIndex], v.exchangeRate) - s.shares[u.shareIndex];
    //         }
    //         if (v._address == delegator) {
    //             commissionEarned[i - start] = v.commissionAvailableToRedeem;
    //         } else {
    //             commissionEarned[i - start] = 0;
    //         }
    //         unstakingAmounts[i - start] = u.amount;
    //         unstakingsEndEpochs[i - start] = u.coolDownEnd;
    //     }

    //     return (staked, rewards, commissionEarned, unstakingAmounts, unstakingsEndEpochs);
    // }

    /*
     * Returns the total amount including compounded stake and unstaked tokens
     * CommissionEarned is also included (if delegator is a validator)
     */
    function getDelegatorTotalLocked(address delegator) external view returns (uint128 totalValueLocked) {
        for (uint128 i = 0; i < validatorsN; i++) {
            Validator storage v = _validators[i];
            Staking storage s = v.stakings[delegator];
            totalValueLocked += _sharesToTokens(s.shares, v.exchangeRate);
            if (v._address == delegator) totalValueLocked += v.commissionAvailableToRedeem;
            Unstaking[] memory unstakings = v.unstakings[delegator];
            uint256 unstakingsN = unstakings.length;
            for (uint256 j = 0; j < unstakingsN; j++) {
                totalValueLocked += unstakings[j].amount;
            }
        }

        return totalValueLocked;
    }

    function checkDelegatorExists(address newAddress) public view returns (bool) {
        for (uint128 i = 0; i < validatorsN; i++) {
            Validator storage v = _validators[i];
            if (v._address == newAddress) {
                return true;
            }

            Staking storage s = v.stakings[newAddress];
            if (s.staked > 0 || s.shares > 0) {
                return true;
            }

            if (v.unstakings[newAddress].length > 0) {
                return true;
            }
        }
        return false;
    }

    function pause() external onlyOwner whenNotPaused {
        _unpaused = false;
        emit Paused(_msgSender());
    }

    function unpause() external onlyOwner {
        require(!_unpaused, "must be paused");
        _unpaused = true;
        emit Unpaused(_msgSender());
    }

    function paused() external view returns (bool) {
        return !_unpaused;
    }

    function freezeValidator(uint128 validatorId, string memory reason) public onlyOwner {
        require(validatorId < validatorsN, "Invalid validator");
        Validator storage v = _validators[validatorId];

        require(!v.frozen, "Validator is already frozen");

        v.frozen = true;
        emit ValidatorFrozen(validatorId, reason);
    }

    function unfreezeValidator(uint128 validatorId) external onlyOwner {
        require(validatorId < validatorsN, "Invalid validator");
        Validator storage v = _validators[validatorId];

        require(v.frozen, "Validator not frozen");

        v.frozen = false;
        emit ValidatorUnfrozen(validatorId);
    }
}
