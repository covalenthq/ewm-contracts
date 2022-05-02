const {expect} = require('chai');
const {
  getAll,
  getDeployedContract,
  getRewardsLocked,
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
  stake,
  addEnabledValidator,
} = require('../../fixtures');

describe('Deposit reward Tokens', function() {
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
    await cqtContract.approve(contract.address, oneToken);
    const oldOwnerBalance = await cqtContract.balanceOf(OWNER);
    expect(await cqtContract.balanceOf(contract.address)).to.equal(0);
    await contract.depositRewardTokens(oneToken);
    expect(await cqtContract.balanceOf(contract.address)).to.equal(oneToken);
    expect(await cqtContract.balanceOf(OWNER)).to.equal(
        oldOwnerBalance.sub(oneToken),
    );
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
    await cqtContract.approve(contract.address, oneToken);
    await contract.depositRewardTokens(oneToken);
    let rewardPool = (await contract.getMetadata())._rewardPool;
    expect(rewardPool).to.equal(oneToken);
    await cqtContract.approve(contract.address, oneToken.mul(100));
    await contract.depositRewardTokens(oneToken.mul(100));
    rewardPool = (await contract.getMetadata())._rewardPool;
    expect(rewardPool).to.equal(oneToken.add(oneToken.mul(100)));
  });

  it('Should emit RewardTokensDeposited event with correct amount.', async function() {
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
    expect(await contract.depositRewardTokens(oneToken))
        .to.emit(contract, 'RewardTokensDeposited')
        .withArgs(oneToken);
    await cqtContract.approve(contract.address, oneToken.mul(100));
    expect(await contract.depositRewardTokens(oneToken.mul(100)))
        .to.emit(contract, 'RewardTokensDeposited')
        .withArgs(oneToken.mul(100));
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
    const amount = 600;
    await cqtContract.approve(contract.address, amount);
    await expect(contract.depositRewardTokens(0)).to.be.revertedWith(
        'Amount is 0',
    );
    await expect(contract.depositRewardTokens(amount + 200)).to.be.reverted;
    await expect(
        contract.depositRewardTokens(
            '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        ),
    ).to.be.reverted;
  });
});
