const {expect} = require('chai');
const {ethers} = require('hardhat');

const {
  stake,
  deposit,
  getAll,
  mineBlocks,
  getOwner,
  getDeployedContract,
  getTokenHolders,
  getMaxCapMultiplier,
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

const {RewardsCalculator} = require('./RewardsCalculator');
const threshold = ethers.BigNumber.from('10000000000000000');

async function stake_(
    calculator,
    amount,
    delegator,
    cqtContract,
    contract,
    id,
) {
  const res = await stake(amount, delegator, cqtContract, contract, id);
  calculator.stake(amount, delegator.address, id);
}
async function recoverStaking(
    calculator,
    amount,
    delegator,
    id,
    unstakingId,
    contract,
) {
  const res = await contract
      .connect(delegator)
      .recoverUnstaking(amount, id, unstakingId);
  calculator.stake(amount, delegator.address, id);
}

async function _unstake(calculator, contract, delegator, id, amount) {
  const res = await contract.connect(delegator).unstake(id, amount);
  calculator.unstake(amount, delegator.address, id);
}

async function getEvent(txResult, eventName) {
  const receipt = await txResult.wait();
  const events = receipt.events.filter((x) => {
    return x.event == eventName;
  });
  return events[0];
}

async function getRedeemedAmount(txResult) {
  const event = await getEvent(txResult, 'RewardRedeemed');
  return event.args.amount;
}

async function getRedeemedCommission(txResult) {
  const event = await getEvent(txResult, 'CommissionRewardRedeemed');
  return event.args.amount;
}

async function redeemAllAndCompare(calculator, delegator, id, contract) {
  const res = await contract
      .connect(delegator)
      .redeemAllRewards(id, delegator.address);

  const reward = calculator.getRewards(delegator.address, id);
  const redeemed = await getRedeemedAmount(res);
  expect(redeemed).to.be.closeTo(reward[0].toString(), threshold);
  if (calculator.isValidator(id, delegator.address)) {
    const res1 = await contract
      .connect(delegator)
      .redeemAllCommission(id, delegator.address);

    expect(await getRedeemedCommission(res1)).to.be.closeTo(
        reward[1].toString(),
        threshold,
    );
    calculator.redeemAllCommission(id);
  }
  calculator.redeemAllRewards(delegator.address, id);
}

async function redeemAndCompare(calculator, delegator, id, contract, amount) {
  const res = await contract
      .connect(delegator)
      .redeemRewards(id, delegator.address, amount);
  const reward = calculator.getRewards(delegator.address, id);
  let expectedReward = amount;

  const redeemed = await getRedeemedAmount(res);
  if (expectedReward != 0) {
    expect(redeemed).to.be.closeTo(expectedReward.toString(), threshold);
  }
  calculator.redeemRewards(amount, delegator.address, id);
}

async function rewardValidator(calculator, opManager, contract, amount, id) {
  calculator.rewardValidator(id, amount);
  await contract.connect(opManager).rewardValidators([id], [amount]);
}

async function _mineBlocks(epochs, calculator) {
  await mineBlocks(epochs);
  calculator.mineBlocks(epochs);
}
async function addValidator(
    id,
    opManager,
    contract,
    vAddress,
    oAddress,
    rate,
    calculator,
    id,
) {
  await addEnabledValidator(id, contract, opManager, vAddress, rate);
  calculator.addValidator(id, rate, vAddress);
}

async function disableValidator(contract, calculator, id) {
  const res = await contract.disableValidator(id);
  calculator.disableValidator(id, res.blockNumber);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function redelegate(
    contract,
    oldId,
    newId,
    delegator,
    unstakingId,
    amount,
    calculator,
) {
  const res = await contract
      .connect(delegator)
      .redelegateUnstaked(amount, oldId, newId, unstakingId);
  calculator.stake(amount, delegator.address, newId, res.blockNumber);
}

describe('All together', function() {
  it('Should redeem, stake, unstake and recover correct # of tokens.', async function() {
    this.timeout(50000);
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
      v3,
      v4,
    ] = await getAll();
    const tokenHolders = await getTokenHolders();
    deposit(contract, oneToken.mul(10000000));
    await contract.connect(opManager).setMaxCapMultiplier(10);
    const v1Rate = ethers.BigNumber.from('100000000000000000');
    const calculator = new RewardsCalculator(oneToken);
    await addValidator(
        0,
        opManager,
        contract,
        VALIDATOR_1,
        OPERATOR_1,
        v1Rate,
        calculator,
        0,
    );
    const amount = oneToken.mul(100000);

    await stake(amount, validator1, cqtContract, contract, 0);
    calculator.stake(amount, validator1.address, 0);
    let reward = oneToken;
    await rewardValidator(calculator, opManager, contract, reward, 0);
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[0],
        cqtContract,
        contract,
        0,
    );
    await rewardValidator(calculator, opManager, contract, reward, 0);
    await _unstake(
        calculator,
        contract,
        tokenHolders[0],
        '0',
        oneToken.mul(10000),
    );
    await stake_(
        calculator,
        oneToken.mul(10000),
        validator1,
        cqtContract,
        contract,
        0,
    );
    await rewardValidator(calculator, opManager, contract, reward, 0);
    await redeemAllAndCompare(calculator, validator1, '0', contract);
    await recoverStaking(
        calculator,
        oneToken.mul(10000),
        tokenHolders[0],
        '0',
        0,
        contract,
    );

    await stake_(
        calculator,
        oneToken.mul(50000),
        validator2,
        cqtContract,
        contract,
        0,
    );
    reward = oneToken.mul(1000);
    await rewardValidator(calculator, opManager, contract, reward, 0);
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[1],
        cqtContract,
        contract,
        0,
    );
    await _unstake(calculator, contract, validator2, '0', oneToken.mul(10000));
    await stake_(calculator, oneToken, v4, cqtContract, contract, 0);
    await recoverStaking(
        calculator,
        oneToken.mul(2500),
        validator2,
        '0',
        0,
        contract,
    );

    await rewardValidator(
        calculator,
        opManager,
        contract,
        oneToken.mul(100),
        0,
    );
    await redeemAllAndCompare(calculator, validator2, '0', contract);
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[2],
        cqtContract,
        contract,
        0,
    );
    await _unstake(calculator, contract, validator2, '0', oneToken.mul(40000));

    reward = oneToken.mul(100);
    await rewardValidator(calculator, opManager, contract, reward, 0);
    await stake_(
        calculator,
        oneToken.mul(1000),
        delegator1,
        cqtContract,
        contract,
        0,
    );
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[3],
        cqtContract,
        contract,
        0,
    );
    await stake_(
        calculator,
        oneToken.mul(10000),
        delegator2,
        cqtContract,
        contract,
        0,
    );

    reward = oneToken.mul(10);
    await rewardValidator(calculator, opManager, contract, reward, 0);
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[4],
        cqtContract,
        contract,
        0,
    );
    const v2Rate = ethers.BigNumber.from('10000000000000000');
    await addValidator(
        1,
        opManager,
        contract,
        v3.address,
        v3.address,
        v2Rate,
        calculator,
        1,
    );
    await stake_(
        calculator,
        oneToken.mul(7000000),
        v3,
        cqtContract,
        contract,
        1,
    );
    reward = oneToken.mul(1000);
    await rewardValidator(calculator, opManager, contract, reward, 0);
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[5],
        cqtContract,
        contract,
        0,
    );
    await stake_(calculator, oneToken.mul(7000), v3, cqtContract, contract, 1);

    await redeemAndCompare(calculator, delegator2, '0', contract, oneToken);
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[6],
        cqtContract,
        contract,
        0,
    );
    reward = oneToken.mul(50);
    await rewardValidator(calculator, opManager, contract, reward, 1);

    await stake_(
        calculator,
        oneToken.mul(7000),
        delegator2,
        cqtContract,
        contract,
        1,
    );
    reward = oneToken.mul(900);
    await rewardValidator(calculator, opManager, contract, reward, 1);
    await redeemAndCompare(calculator, v3, '1', contract, oneToken.mul(400));
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[7],
        cqtContract,
        contract,
        0,
    );

    reward = oneToken.mul(1);
    rewardValidator(calculator, opManager, contract, reward, 0);

    await _unstake(calculator, contract, validator1, '0', oneToken.mul(10000));
    reward = oneToken.mul(1500);
    rewardValidator(calculator, opManager, contract, reward, 0);
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[8],
        cqtContract,
        contract,
        0,
    );
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[9],
        cqtContract,
        contract,
        0,
    );
    await stake_(
        calculator,
        oneToken.mul(10000),
        tokenHolders[10],
        cqtContract,
        contract,
        0,
    );

    for (let i = 1; i < 100; i++) {
      await stake_(
          calculator,
          oneToken.mul(i),
          delegator1,
          cqtContract,
          contract,
          1,
      );
      reward = oneToken.mul(i);
      rewardValidator(calculator, opManager, contract, reward, 1);
      await redeemAllAndCompare(calculator, delegator1, '1', contract);
    }

    for (let i = 1; i < 100; i++) {
      await stake_(
          calculator,
          oneToken.mul(i),
          validator1,
          cqtContract,
          contract,
          1,
      );

      reward = oneToken.mul(i).mul(10);
      comRew = calculator.getRewards(v3.address, 1)[1];

      rewardValidator(calculator, opManager, contract, reward, 1);
      await redeemAndCompare(calculator, v3, '1', contract, comRew);
      rew = calculator.getRewards(validator1.address, 1)[0].div(2);
      await redeemAndCompare(calculator, validator1, '1', contract, rew);
    }
  });
});
