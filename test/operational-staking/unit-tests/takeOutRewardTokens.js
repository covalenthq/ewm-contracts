const {expect} = require('chai');
const {
  getAll,
  getRewardsLocked,
  oneToken,
  OWNER,
  VALIDATOR_1,
  VALIDATOR_2,
  OPERATOR_1,
  OPERATOR_2,
  DELEGATOR_1,
  DELEGATOR_2,
  CQT,
  deposit,
  stake,
  addEnabledValidator,
} = require('../../fixtures');

describe('Take out reward Tokens', function() {
  it('Should change balance of the contract and the owner.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(100000));
    const oldOwnerBalance = await cqtContract.balanceOf(OWNER);
    await contract.takeOutRewardTokens(oneToken.mul(100));
    expect(await cqtContract.balanceOf(OWNER)).to.equal(
        oldOwnerBalance.add(oneToken.mul(100)),
    );
  });

  it('Should revert with wrong inputs.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await expect(contract.takeOutRewardTokens(0)).to.be.revertedWith(
        'Amount is 0',
    );
    await expect(contract.takeOutRewardTokens(10000000000000000000000000000)).to
        .be.reverted;
    deposit(contract, oneToken.mul(1000000));
    await expect(contract.takeOutRewardTokens(0)).to.be.reverted;
    await expect(contract.takeOutRewardTokens(10000000000000000000000000000)).to
        .be.reverted;
  });

  it('Should change rewardPool.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await cqtContract.approve(contract.address, oneToken.mul(100));
    await contract.depositRewardTokens(oneToken.mul(100));
    await contract.takeOutRewardTokens(oneToken.mul(99));
    let rewardPool = (await contract.getMetadata())._rewardPool;
    expect(rewardPool).to.equal(oneToken);

    await cqtContract.approve(contract.address, oneToken.mul(1000));
    await contract.depositRewardTokens(oneToken.mul(1000));
    await contract.takeOutRewardTokens(oneToken.mul(1000));
    rewardPool = (await contract.getMetadata())._rewardPool;
    expect(rewardPool).to.equal(oneToken);
  });

  it('Should emit AllocatedTokensTaken event with correct amount.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await cqtContract.approve(contract.address, oneToken);
    await contract.depositRewardTokens(oneToken);
    expect(await contract.takeOutRewardTokens(oneToken))
        .to.emit(contract, 'AllocatedTokensTaken')
        .withArgs(oneToken);
    await cqtContract.approve(contract.address, oneToken.mul(100));
    await contract.depositRewardTokens(oneToken.mul(100));
    expect(await contract.takeOutRewardTokens(oneToken.mul(100)))
        .to.emit(contract, 'AllocatedTokensTaken')
        .withArgs(oneToken.mul(100));
  });
});
