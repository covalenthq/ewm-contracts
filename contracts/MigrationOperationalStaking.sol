//SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract MigrationOperationalStaking is OwnableUpgradeable {
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

    event DelegatorBurnt(uint128 indexed validatorId, address indexed delegator);

    event MadCQTBurnt(uint128 indexed amount);

    event CQTAddressChanged(address indexed cqt);

    event MadCQTWithdrawn(address indexed cqt, uint256 indexed amount);

    modifier validValidatorId(uint128 validatorId) {
        require(validatorId < validatorsN, "Invalid validator");
        _;
    }

    /*
     * Used to convert validator shares to CQT
     */
    function _sharesToTokens(uint128 sharesN, uint128 rate) internal pure returns (uint128) {
        return uint128((uint256(sharesN) * uint256(rate)) / DIVIDER);
    }

    /*
     * Burn stakes, rewards and unstakes of a predefined list of delegators
     */
    function burnDefaultDelegators() external onlyOwner {
        address[6] memory defaultToBurn = [
            0xe7CCfcc5815131B129c82322B4bA9E10B0159291,
            0x122F83aE6B1677082F2541686b74Ca55Ebb1B58b,
            0xdB6ee35DdbA6AB1F39d4a1369104A543e5De0E11,
            0x128E6bBAa2d269A7D26a3E3AF13Ea86943A05C24,
            0xa312F7156A2F4290D53e5694afE44e9cC7f1B811,
            0x1DB596c09f5B37013B3cc263B9903D2474050F3f
        ];

        uint256 burnLength = defaultToBurn.length;

        for (uint128 i = 0; i < burnLength; i++) {
            for (uint128 validatorId = 0; validatorId < validatorsN; validatorId++) {
                _burnDelegatorBalance(validatorId, defaultToBurn[i]);
            }
        }
    }

    /*
     * Burn delegator's stakes, rewards and unstakes under the given validator
     */
    function burnDelegatorBalance(uint128 validatorId, address delegator) external onlyOwner {
        return _burnDelegatorBalance(validatorId, delegator);
    }

    /*
     * Burn delegator's stakes, rewards and unstakes under the given validator
     */
    function _burnDelegatorBalance(uint128 validatorId, address delegator) internal validValidatorId(validatorId) {
        Validator storage v = _validators[validatorId];
        Staking storage s = v.stakings[delegator];

        // do not allow to burn self staked tokens,
        // put it inside if statements since one of the addresses has self staked tokens
        // but we want to only burn the delegated
        if (delegator == v._address) return;

        uint128 totalValueBurnt = _sharesToTokens(s.shares, v.exchangeRate);

        v.totalShares -= s.shares;
        v.delegated -= s.staked;
        s.shares = 0;
        s.staked = 0;

        // the delegator stakings that we are planning to burn do not have any unstakings
        // but we included implementation here just in case
        // we need to keep track of how much is burnt in total
        Unstaking[] memory unstakings = v.unstakings[delegator];
        uint256 unstakingsN = unstakings.length;
        for (uint128 i = 0; i < unstakingsN; i++) {
            totalValueBurnt += unstakings[i].amount;
        }
        delete v.unstakings[delegator];
        emit DelegatorBurnt(validatorId, delegator);
        emit MadCQTBurnt(totalValueBurnt);
    }

    /*
     * Withdraw all the CQT from the contract to the given wallet
     */
    function withdrawAllMadCQT(address recoveryWallet) external onlyOwner {
        require(recoveryWallet != address(0), "Invalid recovery wallet address");
        uint256 balance = CQT.balanceOf(address(this));
        CQT.safeTransfer(recoveryWallet, balance);
        emit MadCQTWithdrawn(address(CQT), balance);
    }

    /*
     * Set CQT token address
     */
    function setCQTAddress(address newCQT) external onlyOwner {
        require(newCQT != address(0), "Invalid CQT address");
        require(newCQT != address(CQT), "New CQT address cannot be equal to the old one");
        require(CQT.balanceOf(address(this)) == 0, "Cannot change CQT address when balance is > 0");
        CQT = IERC20Upgradeable(newCQT);
        emit CQTAddressChanged(newCQT);
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
     * Returns validator staked and delegated token amounts, excluding compounded rewards
     */
    function getValidatorStakingData(uint128 validatorId) external view validValidatorId(validatorId) returns (uint128 staked, uint128 delegated) {
        Validator storage v = _validators[validatorId];
        return (v.stakings[v._address].staked, v.delegated);
    }

    /*
     * Returns validator staked and delegated token amounts, including compounded rewards
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
        validValidatorId(validatorId)
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

    function renounceOwnership() public virtual override onlyOwner {}
}
