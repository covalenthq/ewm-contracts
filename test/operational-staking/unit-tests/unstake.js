const {expect} = require('chai');
const {ethers} = require('hardhat');
const {
  stake,
  deposit,
  getAll,
  mineBlocks,
  getOwner,
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

describe('Unstaking', function() {
  it('Should revert when unstake is more than staked', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(2000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    expect(contract.connect(validator2).unstake(0, oneToken)).to.revertedWith(
        'Staked < amount provided',
    );
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0);
    expect(
        contract.connect(validator2).unstake(0, oneToken.mul(11)),
    ).to.revertedWith('Staked < amount provided');
    await stake(oneToken.mul(1000), validator2, cqtContract, contract, 0);
    expect(
        contract.connect(validator2).unstake(0, oneToken.mul(1001)),
    ).to.revertedWith('Staked < amount provided');
    expect(
        contract.connect(validator2).unstake(0, oneToken.mul(100000)),
    ).to.revertedWith('Staked < amount provided');
    expect(
        contract.connect(validator2).unstake(0, oneToken.mul(1000).add(1)),
    ).to.revertedWith('Staked < amount provided');
  });

  it('Should revert when unstake is too small', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(2000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(1000), validator2, cqtContract, contract, 0);
    expect(contract.connect(validator2).unstake(0, 1)).to.revertedWith(
        'Unstake amount is too small',
    );
  });

  it('Should revert when unstake beyond max cap', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(2000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await contract.setMaxCapMultiplier(3);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(3000), validator2, cqtContract, contract, 0);
    await expect(
        contract.connect(validator1).unstake(0, oneToken),
    ).to.revertedWith('Cannot unstake beyond max cap');
    await expect(
        contract.connect(validator1).unstake(0, oneToken),
    ).to.revertedWith('Cannot unstake beyond max cap');
  });

  it('Should unstake with safe max cap', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(2000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await contract.setMaxCapMultiplier(3);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(2000), validator2, cqtContract, contract, 0);
    expect(await contract.connect(validator1).unstake(0, oneToken))
        .to.emit(contract, 'Unstaked')
        .withArgs(0, VALIDATOR_1, oneToken.toString(), 0);
  });

  it('Should unstake beyond max cap when validator is disabled', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(2000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await contract.setMaxCapMultiplier(3);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(3000), validator2, cqtContract, contract, 0);
    await contract.disableValidator(0, 789);
    expect(await contract.connect(validator1).unstake(0, oneToken))
        .to.emit(contract, 'Unstaked')
        .withArgs(0, VALIDATOR_1, oneToken.toString(), 0);
  });

  it('Should emit event when unstaked successfully', async function() {
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
    await deposit(contract, oneToken.mul(2000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(required, validator1, cqtContract, contract, 0);
    expect(await contract.connect(validator1).unstake(0, oneToken.mul(900)))
        .to.emit(contract, 'Unstaked')
        .withArgs(0, VALIDATOR_1, oneToken.mul(900).toString(), 0);
  });

  it('Should not change balance of contract or delegator', async function() {
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
    await deposit(contract, oneToken.mul(2000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(required, validator1, cqtContract, contract, 0);
    const oldValidatorBalance = await cqtContract.balanceOf(VALIDATOR_1);
    const oldContractBalance = await cqtContract.balanceOf(contract.address);
    await contract.connect(validator1).unstake(0, oneToken.mul(900));
    expect(await cqtContract.balanceOf(VALIDATOR_1)).to.equal(
        oldValidatorBalance,
    );
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance,
    );
  });

  it('Should revert when validator is invalid', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(20));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    expect(contract.connect(validator1).unstake(1, amount)).to.revertedWith(
        'Invalid validator',
    );
    expect(contract.connect(validator1).unstake(2, oneToken)).to.revertedWith(
        'Invalid validator',
    );
  });
});
