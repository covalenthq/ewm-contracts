//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

interface IOperationalStaking {
    function getValidatorMetadata(uint128 validatorId)
        external
        view
        returns (
            address _address,
            uint128 staked,
            uint128 delegated,
            uint128 commissionRate
        );

    function getValidatorStakingData(uint128 validatorId) external view returns (uint128 staked, uint128 delegated);

    function getValidatorCompoundedStakingData(uint128 validatorId) external view returns (uint128 staked, uint128 delegated);

    function rewardValidators(uint128[] calldata validatorId, uint128[] calldata amount) external;

    function addValidator(address validator, uint128 commissionRate) external returns (uint256 id);

    function disableValidator(uint128 validatorId, uint256 blockNumber) external;

    function enableValidator(uint128 validatorId) external;
}
