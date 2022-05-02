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
  addEnabledValidator,
} = require('../../fixtures');

describe('Redeem All Rewards', function() {
  it('Should emit redeem reward event with correct number of rewards when there are no delegators', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(10000));
    const v1Commission = oneToken.div(10);

    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        v1Commission,
    );
    let amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);

    let tokensGiven = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [ tokensGiven]);
    let tokensGiven2 = oneToken.mul(500);
    await contract.connect(opManager).rewardValidators([0], [ tokensGiven2]);
    const v1GivenFull = tokensGiven.add(tokensGiven2);
    const v1GivenReward = v1GivenFull
        .mul(oneToken.sub(v1Commission))
        .div(oneToken);
    const v1GivenCommission = v1GivenFull.mul(v1Commission).div(oneToken);

    const v2Commission = oneToken.div(20);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_2,
        v2Commission,
    );
    amount = oneToken.mul(2000);
    await stake(amount, validator2, cqtContract, contract, 1);

    tokensGiven = oneToken.mul(300);
    await contract.connect(opManager).rewardValidators([1], [ tokensGiven]);
    tokensGiven2 = oneToken.mul(700);
    await contract.connect(opManager).rewardValidators([1], [ tokensGiven2]);

    const v2GivenFull = tokensGiven.add(tokensGiven2);
    const v2GivenReward = v2GivenFull
        .mul(oneToken.sub(v2Commission))
        .div(oneToken);
    const v2GivenCommission = v2GivenFull.mul(v2Commission).div(oneToken);

    const res1 = await contract
        .connect(validator1)
        .redeemAllRewards(0, validator1.address);
    await expect(res1)
        .to.emit(contract, 'RewardRedeemed')
        .withArgs(0, validator1.address, v1GivenReward);
    await expect(res1)
        .to.emit(contract, 'CommissionRewardRedeemed')
        .withArgs(0, validator1.address, v1GivenCommission);

    const res2 = await contract
        .connect(validator2)
        .redeemAllRewards(1, validator2.address);
    await expect(res2)
        .to.emit(contract, 'RewardRedeemed')
        .withArgs(1, validator2.address, v2GivenReward);
    await expect(res2)
        .to.emit(contract, 'CommissionRewardRedeemed')
        .withArgs(1, validator2.address, v2GivenCommission);
  });

  it('Should emit redeem reward event with correct number of rewards when there are delegators', async function() {
    // TODO: this one
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(10000));
    const v1Commission = oneToken.div(10);

    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        v1Commission,
    );
    let amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);

    let tokensGiven = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [ tokensGiven]);
    let tokensGiven2 = oneToken.mul(500);
    await contract.connect(opManager).rewardValidators([0], [ tokensGiven2]);
    const v1GivenFull = tokensGiven.add(tokensGiven2);
    const v1GivenReward = v1GivenFull
        .mul(oneToken.sub(v1Commission))
        .div(oneToken);
    const v1GivenCommission = v1GivenFull.mul(v1Commission).div(oneToken);

    const v2Commission = oneToken.div(20);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_2,
        v2Commission,
    );
    amount = oneToken.mul(2000);
    await stake(amount, validator2, cqtContract, contract, 1);

    tokensGiven = oneToken.mul(300);
    await contract.connect(opManager).rewardValidators([1], [ tokensGiven]);
    tokensGiven2 = oneToken.mul(700);
    await contract.connect(opManager).rewardValidators([1], [ tokensGiven2]);

    const v2GivenFull = tokensGiven.add(tokensGiven2);
    const v2GivenReward = v2GivenFull
        .mul(oneToken.sub(v2Commission))
        .div(oneToken);
    const v2GivenCommission = v2GivenFull.mul(v2Commission).div(oneToken);

    const res1 = await contract
        .connect(validator1)
        .redeemAllRewards(0, validator1.address);
    await expect(res1)
        .to.emit(contract, 'RewardRedeemed')
        .withArgs(0, validator1.address, v1GivenReward);
    await expect(res1)
        .to.emit(contract, 'CommissionRewardRedeemed')
        .withArgs(0, validator1.address, v1GivenCommission);

    const res2 = await contract
        .connect(validator2)
        .redeemAllRewards(1, validator2.address);
    await expect(res2)
        .to.emit(contract, 'RewardRedeemed')
        .withArgs(1, validator2.address, v2GivenReward);
    await expect(res2)
        .to.emit(contract, 'CommissionRewardRedeemed')
        .withArgs(1, validator2.address, v2GivenCommission);
  });

  it('Should change balances of the contract and delegator', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(10000));
    const v1Commission = oneToken.div(10);

    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        v1Commission,
    );
    let amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);

    let tokensGiven = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [ tokensGiven]);
    let tokensGiven2 = oneToken.mul(500);
    await contract.connect(opManager).rewardValidators([0], [ tokensGiven2]);
    const v1GivenFull = tokensGiven.add(tokensGiven2);
    const v1GivenReward = v1GivenFull
        .mul(oneToken.sub(v1Commission))
        .div(oneToken);
    const v1GivenCommission = v1GivenFull.mul(v1Commission).div(oneToken);

    const v2Commission = oneToken.div(20);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_2,
        v2Commission,
    );
    amount = oneToken.mul(2000);
    await stake(amount, validator2, cqtContract, contract, 1);

    tokensGiven = oneToken.mul(300);
    await contract.connect(opManager).rewardValidators([1], [ tokensGiven]);
    tokensGiven2 = oneToken.mul(700);
    await contract.connect(opManager).rewardValidators([1], [ tokensGiven2]);

    const v2GivenFull = tokensGiven.add(tokensGiven2);
    const v2GivenReward = v2GivenFull
        .mul(oneToken.sub(v2Commission))
        .div(oneToken);
    const v2GivenCommission = v2GivenFull.mul(v2Commission).div(oneToken);

    let oldOwnerBalance = await cqtContract.balanceOf(VALIDATOR_1);
    let oldContractBalance = await cqtContract.balanceOf(contract.address);
    await contract.connect(validator1).redeemAllRewards(0, validator1.address);
    expect(await cqtContract.balanceOf(VALIDATOR_1)).to.equal(
        oldOwnerBalance.add(v1GivenReward).add(v1GivenCommission),
    );
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.sub(v1GivenReward).sub(v1GivenCommission),
    );

    oldOwnerBalance = await cqtContract.balanceOf(VALIDATOR_2);
    oldContractBalance = await cqtContract.balanceOf(contract.address);
    await contract.connect(validator2).redeemAllRewards(1, validator2.address);
    expect(await cqtContract.balanceOf(VALIDATOR_2)).to.equal(
        oldOwnerBalance.add(v2GivenReward).add(v2GivenCommission),
    );
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.sub(v2GivenReward).sub(v2GivenCommission),
    );
  });

  it('Should revert with nothing to redeem', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(10000));
    const v1Commission = oneToken.div(10);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        v1Commission,
    );
    let amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    let tokensGiven = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [ tokensGiven]);
    let tokensGiven2 = oneToken.mul(500);
    await contract.connect(opManager).rewardValidators([0], [ tokensGiven2]);
    const v2Commission = oneToken.div(20);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_2,
        v2Commission,
    );
    amount = oneToken.mul(2000);
    await stake(amount, validator2, cqtContract, contract, 1);

    tokensGiven = oneToken.mul(300);
    await contract.connect(opManager).rewardValidators([1], [ tokensGiven]);
    tokensGiven2 = oneToken.mul(700);
    await contract.connect(opManager).rewardValidators([1], [ tokensGiven2]);

    await contract.connect(validator1).redeemAllRewards(0, validator1.address);
    await expect(
        contract.connect(validator1).redeemAllRewards(0, validator1.address),
    ).to.revertedWith('Nothing to redeem');

    await contract.connect(validator2).redeemAllRewards(1, validator2.address);
    await expect(
        contract.connect(validator1).redeemAllRewards(1, validator2.address),
    ).to.revertedWith('Nothing to redeem');
  });

  it('Should revert with invalid beneficiary', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(10000));
    const v1Commission = oneToken.div(10);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        v1Commission,
    );
    await expect(
        contract
            .connect(validator1)
            .redeemAllRewards(0, '0x0000000000000000000000000000000000000000'),
    ).to.revertedWith('Invalid beneficiary');
  });
});
