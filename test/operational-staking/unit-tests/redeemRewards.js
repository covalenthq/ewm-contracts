const {expect} = require('chai');
const {ethers} = require('hardhat');

const {
  stake,
  deposit,
  getAll,
  mineBlocks,
  getOwner,
  getDeployedContract,
  getAllocatedTokensPerEpoch,
  getEndEpoch,
  oneToken,
  OWNER,
  VALIDATOR_1,
  VALIDATOR_2,
  OPERATOR_1,
  OPERATOR_2,
  DELEGATOR_1,
  DELEGATOR_2,
  CQT,
} = require('../../fixtures');

describe('Redeem Rewards', function() {
  it('Should revert when requested amount 0', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(1000));
    const v1Commission = oneToken.div(10);
    await contract.connect(opManager).addValidator(VALIDATOR_1, v1Commission);

    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    const tokensGiven = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [tokensGiven]);

    await expect(
        contract.connect(validator1).redeemRewards(0, validator1.address, 0),
    ).to.revertedWith('Amount is 0');
  });

  it('Should revert when requested amount is too high', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(1000));
    const v1Commission = oneToken.div(10);
    await contract.connect(opManager).addValidator(VALIDATOR_1, v1Commission);

    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    const tokensGiven = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [tokensGiven]);

    await expect(
        contract
            .connect(validator1)
            .redeemRewards(0, validator1.address, tokensGiven.add(1)),
    ).to.revertedWith('Requested amount is too high');
  });


  it('Should revert when trying to redeem from invalid validator', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(1000));
    const v1Commission = oneToken.div(10);
    await contract.connect(opManager).addValidator(VALIDATOR_1, v1Commission);

    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    const tokensGiven = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [tokensGiven]);

    expect(
        contract.connect(validator1).redeemRewards(10, validator1.address, 1),
    ).to.revertedWith('Invalid validator');
  });

  it('Should revert when redeem amount is too small', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(1000));
    const v1Commission = oneToken.div(10);
    await contract.connect(opManager).addValidator(VALIDATOR_1, v1Commission);

    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    const tokensGiven = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [tokensGiven]);


    let REWARD_REDEEM_THRESHOLD = 10^8
    let amount2 = REWARD_REDEEM_THRESHOLD - 1

    expect(
        contract.connect(validator1).redeemRewards(0, validator1.address, amount2),
    ).to.revertedWith('Requested amount must be higher than redeem threshold');
  });
});
