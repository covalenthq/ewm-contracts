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

describe('Recover Unstaking', function() {
  it('Should revert when recover invalid unstaking', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const required = oneToken.mul(10000);
    await deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(required, validator1, cqtContract, contract, 0);
    await contract.connect(validator1).unstake(0, oneToken.mul(900));
    expect(
        contract.connect(validator1).recoverUnstaking(oneToken.mul(1000), 0, 1),
    ).to.revertedWith('Unstaking does not exist');
    expect(
        contract.connect(validator1).recoverUnstaking(oneToken.mul(1000), 1, 1),
    ).to.revertedWith('Unstaking does not exist');
  });

  it('Should revert when recover greater than staking', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const required = oneToken.mul(10000);
    await deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(required, validator1, cqtContract, contract, 0);
    await contract.connect(validator1).unstake(0, oneToken.mul(900));
    expect(
        contract.connect(validator1).recoverUnstaking(oneToken.mul(1000), 0, 0),
    ).to.revertedWith('Unstaking has less tokens');
  });

  it('Should emit event when recovered unstake successfully', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const required = oneToken.mul(10000);
    await deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(required, validator1, cqtContract, contract, 0);
    await contract.connect(validator1).unstake(0, oneToken.mul(900));
    let res = await contract
        .connect(validator1)
        .recoverUnstaking(oneToken.mul(200), 0, 0);
    expect(res)
        .to.emit(contract, 'RecoveredUnstake')
        .withArgs(0, VALIDATOR_1, oneToken.mul(200).toString(), 0);
    expect(res)
        .to.emit(contract, 'Staked')
        .withArgs(0, VALIDATOR_1, oneToken.mul(200).toString());

    res = await contract
        .connect(validator1)
        .recoverUnstaking(oneToken.mul(700), 0, 0);
    expect(res)
        .to.emit(contract, 'RecoveredUnstake')
        .withArgs(0, VALIDATOR_1, oneToken.mul(700).toString(), 0);
    expect(res)
        .to.emit(contract, 'Staked')
        .withArgs(0, VALIDATOR_1, oneToken.mul(700).toString());
  });

  it('Should revert when try to recover the same unstake second time', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const required = oneToken.mul(1000);
    await deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(required, validator1, cqtContract, contract, 0);
    await contract.connect(validator1).unstake(0, required);
    await contract.connect(validator1).recoverUnstaking(required, 0, 0);
    await expect(
        contract.connect(validator1).recoverUnstaking(required, 0, 0),
    ).to.revertedWith('Unstaking has less tokens');
  });

  it('Should not change contract balance', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();

    const required = oneToken.mul(1000);
    await deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(required, validator1, cqtContract, contract, 0);
    await contract.connect(validator1).unstake(0, oneToken.mul(900));
    const oldContractBalance = await cqtContract.balanceOf(contract.address);
    let res = await contract
        .connect(validator1)
        .recoverUnstaking(oneToken.mul(200), 0, 0);
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance,
    );
    res = await contract
        .connect(validator1)
        .recoverUnstaking(oneToken.mul(700), 0, 0);
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance,
    );
  });
});
