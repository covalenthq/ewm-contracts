# operational-staking

[![codecov](https://codecov.io/gh/covalenthq/operational-staking/branch/main/graph/badge.svg?token=VFEMI1ZKW6)](https://codecov.io/gh/covalenthq/operational-staking)

## Hardhat

[Getting started](https://hardhat.org/getting-started/)

- To start a node: `$npx hardhat node`
- To compile: `$npx hardhat compile`
- To run all tests: `$npx hardhat test`
- to run a specific test: `$npx hardhat test path/to/test`

# Set up

### Installation

1. Clone repo
2. Run `npm install`

### Testing

You need to have access to an archive node. Place the node url into hardhat.config.js:

```
...
networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: "http://you.rpc.url.here",
        blockNumber: 13182263
      }
...
```

#### Run

`npx hardhat test ./test/staking-contract-test/unit-tests/*`

`npx hardhat test ./test/staking-contract-test/integration-tests/all`

`npx hardhat test ./test/proof-chain-test/unit-tests/*`

The tests have to be run in chunks so the accounts don't run out of Ether.

### Deploy to local test network

To deploy the contracts to a local network with contract parameters set up and 1 block specimen producer enabled,  run
`npx hardhat run scripts/deployWithSetup.js`

# Staking Explained

### The goal:

To distribute tokens to stakers.

The reward emission will be pushed from the StakingManager contract every checkpoint. The StakingManager does not require an audit for now and for the scope of the Staking contract it does not matter how the pushed rewards were calculated. A checkpoint is defined as a transaction in which the rewards are pushed and will happen every couple of blocks. The checkpoint transaction determines the rewards amount, hence it is unknown how many rewards will be pushed to a validator beforehand.

There are four types of entities: Validators (who self-delegate), Delegators (who delegate tokens to the validators), the Owner (Covalent) and the StakingManager (Covalent contract).

Delegators pay commission fees from their earned reward based on the commission rate dictated by validators. The validators will be added to the contract by the StakingManager and will be disabled until the StakingManager activates its instance.

### Validators are subject to the following constraints:

- If a validator misbehaves (does not run a Covalent node or cheats), the StakingManager can disable the validator instance on the contract. The StakingManager will call disabledValidator/enableValidator functions on the Staking contract.
- Maximum # of tokens that can be staked (self-delegated) by a validator.
- Validator max cap - is the maximum number of tokens the delegators can cumulatively delegate to a validator. That number is determined by the following formula: `#_of_tokens_staked_by_validator * validator_max_cap_multiplier`, where `validator_max_cap_multiplier` is a number that is set by Covalent. </br>
  An example of max cap: </br>
  Assuming validator_max_cap_multiplier is set to `10`, then a validator comes and stakes 1 million tokens. The max cap of the validator is `10 * 1 million = 10 million`. So delegator `A` comes and delegates `3 million`, delegator `B` - `2 million`, and delegator `C` - `5 million`. In other words, the total number of tokens delegated already equals the maximum cap of `10 million`. Thus, a new delegator 'D' cannot delegate tokens to the validator unless someone unstakes their tokens.
- A validator cannot unstake tokens that would reduce the maximum cap below what is already delegated. If a validator is willing to do so, the validator will have to disable itself through the StakingManager. The delegators will stop earning the rewards from that validator, but they will have an option to redelegate tokens to another validator without a cool down period. The validator can enable its instance back through the StakingManager.

### Redeeming Rewards:

Delegators and validators can decide whether to withdraw all of their rewards or just a portion of them and may do so at any time without a cool-down period. To support certain use cases like pseudoanonymity preservation, the users can set a different address from their wallet address to which rewards will be transferred.

### Unstaking:

Validators who self-delegate will have to wait 180 days for their unstaking to be unlocked, while delegators have to wait 28 days. Once unstaking is unlocked, tokens can be transferred back into the delegator's or validator's wallet.
An unstaked amount can always be recovered: The unstaked amount (partially or in full) can be delegated back to the same validator.

### What the owner can do:

- Deposit tokens into the contract that will be distributed (reward pool)
- Withdraw tokens from the contract that are supposed to be distributed. The owner cannot withdraw tokens allocated for the past checkpoints that have not yet been redeemed by the delegators
- Set the validator max cap multiplier
- Set the maximum number of tokens the validator can stake
- Set the StakingManager address

### What the StakingManager can do:

- Set the validator commission rate
- Add validator instances to the contract
- Reward validators
- Disable/Enable validators

### What a validator can do:

- Redeem rewards (from commissions paid to them and their earned interest)
- Stake or self-delegate
- Unstake
- Transfer out unlocked unstake
- Restake back unstake

_Note: Validators cannot set their commission rate, and if they wish to change it, they must contact Covalent. Commission rates are initially set when the StakingManager adds a validator for the first time._

### What a delegator can do:

- Redeem rewards (their earned interest)
- Stake
- Re-delegate from disabled validator. A delegator first has to unstake then re-delegate unstaked. If a validator gets enabled back, a delegator cannot re-delegate unstake, but she or he can recover that unstake back to the current validator.
- Unstake
- Transfer out unlocked unstake
- Restake back unstake

### Staking contract does not need to know:

- how slashing/rewards are calculated per validator per checkpoint
- how it's decided when validator gets disabled

### Staking Math

Assume tokens are emitted at checkpoint = 1000

- Epoch 1 - person `A` stakes `10,000` tokens and no one else has anything staked
- Epoch 2 -
  person `A` receives `1,000` tokens reward which is `100%` of tokens emitted at a particular checkpoint <br />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;person `B` stakes `20,000` tokens
- Epoch 3 -
  person `A` receives `355` tokens since that person's ratio of tokens staked is `35.5% = 11,000 / (11,000 + 20,000)` <br />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;person `B` receives `645` tokens since that person's ratio of tokens staked is `64.5% = 20,000 / (11,000 + 20,000)`

| Checkpoint # | Staked by A | New staked added by A | Ratio owned by A | Staked by B | New staked added by B | Ratio owned by B |
| ------------ | ----------- | --------------------- | ---------------- | ----------- | --------------------- | ---------------- |
| Checkpoint 1 | 0           | 10,000                | 0                | 0           | 0                     | 0                |
| Checkpoint 2 | 11,000      | 0                     | 100%             | 0           | 20,000                | 0                |
| Checkpoint 3 | 11,355      | 0                     | 35.5%            | 20,645      | 0                     | 64.5%            |

### Staking Math Contract Implementation

We use the concept of ratios or in other words, exchange rates.
Each validator has its own exchange rate. Stakers buy validator shares.
When they unstake or redeem the rewards, they sell the shares. Selling means these shares get burnt.

- Initially the validator exchange rate is `1 share = 1 token`.

- Then staker `A` comes and stakes `10,000` tokens, it receives `10,000` validator shares.

- Assume at the next checkpoint the emission is `1000` tokens, and the validator commission rate is `25%`.

- Then `1000` tokens will be distributed to the stakers.

- Since there is a commission rate of `25%`, `250` tokens will go towards commission paid, and `750` tokens are distributed among the validator shares.

- Then the validator exchange rate would be:

`old_validator_exchange_rate + 750 tokens / 10,000 validator shares = 1 + 0.075 = 1.075`

- So `1 validator share = 1.075` tokens, a validator will have `250` commission tokens available to redeem.

### Precision Loss

There is a slight precision loss in rewards calculation. It is acceptable as long as it is small enough (less than ~ 0.01 a day).

### Assumptions

- Cool down periods might be changed with the next upgrade, so these are not constant.
- Commission earned by validators is not compounded towards the shares that the validator has
- The contract should be upgreadable

# Proof Chain Overview

The Proof Chain contract is a state machine that:

- Accepts proofs in the form of hashes
- Compares hashes to find consensus
- Allows arbitration if consensus is not found

## Operators

An `Operator` is an agent-object that performs some task. In v1, the only task is Block Specimen production.

## Block Specimens

A Block Specimen is an object generated by replicating block data. Block Specimens are generated by running a geth node with Covalent's Block Specimen Production agent: [bsp-agent](https://github.com/covalenthq/bsp-agent).

### Block Specimen Proofs

A proof of the block specimen is in the form of a hash of the Block Specimen's data. A `BlockSpecimenProof` is submitted to the Proof Chain contract containing the hash and other identifying information.

## Block Specimen Session

A `BlockSpecimenSession` is period of time when bsp-agents can submit `BlockSpecimenProof`s. The session tracks who has contributed which proofs.

Once a session starts:

- any `Operator` with the bsp-role can submit a `BlockSpecimenProof`
- the smart contract compares the hashes of each submitted proof

After a period of time, one of the following will happen:

1. majority agreement will be found amongst the submitted proofs
2. no majority agreement found
3. not enough submissions -> time runs out

### 1. Majority agreement is found

If a sufficient number of equal proof hashes are found[^1], an internal function `finalizeAndRewardSpecimenSession` is called. This function ends the session and rewards those who contributed.

### 2. No majority agreement found

If there is not sufficient agreement between submitted proofs, but enough of the bsp-agents have submitted a proof[^2], the session pauses and flips a flag `requiresArbitration = true;`.

### 3. Time runs out

After a defined number of blocks have passed, the session pauses and flips a flag `requiresArbitration = true;`.

[^1]: Sufficient agreement as defined by being a majority ratio like 2/3
[^2]: A submission threshold defined as a ratio like 8/10

## Arbitration

If agreement is not found, arbitration is required. In v1, arbitration is done using Covalent as ground truth.

A Covalent account will have `AUDITOR_ROLE` and can call `arbitrateBlockSpecimenSession(blockHeight, definitiveSpecimenHash)`.

`Operators` who are found to have proof hashes that match the Auditor's are rewarded. The session is finalized.

## Rewards

The reward function is likely to change but as I write this on February 24, 2020 it works as a simple linear relationship:
`reward = (allocatedReward) * stake / totalStakes`

A reward is sent to an `Operator` if they submitted a hash that was equal to the one that was agreed upon.

## Role Management

A large portion of the smart contract is managing roles of operators. Their role(s) determine what actions they can take. There are currently 3 roles: `BLOCK_SPECIMEN_PRODUCER_ROLE`, `AUDITOR_ROLE`, and `GOVERNANCE_ROLE`. The first two are described above.

### Governance Role

All of the smart contract parameters that can be varied are controlled by those holding the `GOVERNANCE_ROLE`. The Governance Role initially acts as a centralized point of control while the remainder of network is being built out.
