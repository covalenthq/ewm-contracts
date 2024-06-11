//SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract TokenSetterStaking is OwnableUpgradeable {
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

    event Paused(address account);

    event Unpaused(address account);

    event CQTAddressChanged(address indexed cqt);

    modifier whenNotPaused() {
        require(_unpaused, "paused");
        _;
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

    /*
     * Set CQT token address
     */
    function setCQTAddress(address newCQT) external onlyOwner {
        require(newCQT != address(0), "Invalid CQT address");
        require(newCQT != address(CQT), "New CQT address cannot be equal to the old one");
        CQT = IERC20Upgradeable(newCQT);
        emit CQTAddressChanged(newCQT);
    }
}
