//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

// blank interface contract which earlier at interface of OperationalStaking.sol which needed to be exposed to proof chain contracts.
// but now this is not needed anymore -- the functions are removed, but due to the upgrade rules of smart contract, we cannot remove the interface.
interface IOperationalStaking {}
