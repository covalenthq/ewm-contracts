const {expect} = require('chai');
const {ethers} = require('hardhat');
const {
  stake,
  deposit,
  getAll,
  mineBlocks,
  getOwner,
  getDeployedContract,
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

describe('Staking', function() {
  it('Should stake when validator is disabled', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(1000));
    await contract.connect(opManager).addValidator(VALIDATOR_1, 1000000000000);
    await stake(oneToken.mul(10000), validator1, cqtContract, contract, 0);
    expect(await stake(oneToken, validator1, cqtContract, contract, 0))
        .to.emit(contract, 'Staked')
        .withArgs(0, VALIDATOR_1, oneToken.toString());
  });

  it('Should revert when transfer not approved', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    expect(
        contract.connect(validator1).stake(0, oneToken.mul(5)),
    ).to.revertedWith('ERC20: transfer amount exceeds allowance');
    expect(contract.connect(validator1).stake(0, oneToken)).to.revertedWith(
        'ERC20: transfer amount exceeds allowance',
    );
    expect(
        contract.connect(validator1).stake(0, oneToken.mul(500000)),
    ).to.revertedWith('ERC20: transfer amount exceeds allowance');
  });

  it('Should stake 1 token and emit event with correct number', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(oneToken.mul(10000), validator1, cqtContract, contract, 0);
    expect(await stake(oneToken, validator2, cqtContract, contract, 0))
        .to.emit(contract, 'Staked')
        .withArgs(0, VALIDATOR_2, oneToken.toString());
  });

  it('Should return correct delegated # ', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(1000));
    await contract.setMaxCapMultiplier(10);

    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    let delegated1 = ethers.BigNumber.from(0);
    let delegated2 = ethers.BigNumber.from(0);
    let vDelegated = ethers.BigNumber.from(0);

    await stake(amount, validator1, cqtContract, contract, 0);
    vDelegated = vDelegated.add(amount);
    await mineBlocks(100);
    await stake(amount, delegator1, cqtContract, contract, 0);
    delegated1 = delegated1.add(amount);

    await mineBlocks(100);
    await stake(amount, validator2, cqtContract, contract, 0);
    delegated2 = delegated2.add(amount);

    await mineBlocks(100);
    await stake(amount, delegator1, cqtContract, contract, 0);
    delegated1 = delegated1.add(amount);

    await mineBlocks(100);
    await stake(amount, delegator1, cqtContract, contract, 0);
    delegated1 = delegated1.add(amount);

    const vDetails = await contract.getDelegatorMetadata(validator1.address, 0);
    expect(vDetails.staked.toString()).to.equal(vDelegated.toString());
    const d1Details = await contract.getDelegatorMetadata(
        delegator1.address,
        0,
    );
    expect(d1Details.staked.toString()).to.equal(delegated1.toString());
    const d2Details = await contract.getDelegatorMetadata(
        validator2.address,
        0,
    );
    expect(d2Details.staked.toString()).to.equal(delegated2.toString());
    const totalStakedExpected = vDetails.staked
        .add(d1Details.staked)
        .add(d2Details.staked);
    const vData = await contract.getValidatorMetadata(0);
    const totalStaked = vData.staked.add(vData.delegated);
    expect(totalStaked).to.equal(totalStakedExpected);
  });

  it('Should revert when stake by validator is more than stake max cap', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const maxCap = oneToken.mul(1000);
    await contract.setValidatorMaxStake(maxCap);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );

    await cqtContract
        .connect(validator1)
        .approve(contract.address, maxCap.add(1));
    await expect(
        contract.connect(validator1).stake(0, maxCap.add(1)),
    ).to.revertedWith('Validator max stake exceeded');
    await cqtContract.connect(validator1).approve(contract.address, maxCap);
    await contract.connect(validator1).stake(0, maxCap);
    await expect(
        contract.connect(validator1).stake(0, oneToken),
    ).to.revertedWith('Validator max stake exceeded');
  });

  it('Should revert when stake to invalid validator', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await expect(
        contract.connect(validator1).stake(0, oneToken),
    ).to.revertedWith('Invalid validator');
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await expect(
        contract.connect(validator1).stake(1, oneToken),
    ).to.revertedWith('Invalid validator');
  });

  it('Should change contract balance', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();

    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );

    let oldContractBalance = await cqtContract.balanceOf(contract.address);
    await cqtContract.connect(validator1).approve(contract.address, oneToken);
    await contract.connect(validator1).stake(0, oneToken);
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.add(oneToken),
    );

    oldContractBalance = await cqtContract.balanceOf(contract.address);
    await cqtContract
        .connect(validator1)
        .approve(contract.address, oneToken.mul(10));
    await contract.connect(validator1).stake(0, oneToken.mul(10));
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.add(oneToken.mul(10)),
    );

    oldContractBalance = await cqtContract.balanceOf(contract.address);
    await cqtContract
        .connect(validator1)
        .approve(contract.address, oneToken.mul(1000));
    await contract.connect(validator1).stake(0, oneToken.mul(1000));
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.add(oneToken.mul(1000)),
    );
  });

  it('Should change delegator balance', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();

    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );

    let oldOwnerBalance = await cqtContract.balanceOf(VALIDATOR_1);
    await cqtContract.connect(validator1).approve(contract.address, oneToken);
    await contract.connect(validator1).stake(0, oneToken);
    expect(await cqtContract.balanceOf(VALIDATOR_1)).to.equal(
        oldOwnerBalance.sub(oneToken),
    );

    oldOwnerBalance = await cqtContract.balanceOf(VALIDATOR_1);
    await cqtContract
        .connect(validator1)
        .approve(contract.address, oneToken.mul(10));
    await contract.connect(validator1).stake(0, oneToken.mul(10));
    expect(await cqtContract.balanceOf(VALIDATOR_1)).to.equal(
        oldOwnerBalance.sub(oneToken.mul(10)),
    );

    oldOwnerBalance = await cqtContract.balanceOf(VALIDATOR_1);
    await cqtContract
        .connect(validator1)
        .approve(contract.address, oneToken.mul(1000));
    await contract.connect(validator1).stake(0, oneToken.mul(1000));
    expect(await cqtContract.balanceOf(VALIDATOR_1)).to.equal(
        oldOwnerBalance.sub(oneToken.mul(1000)),
    );
  });

  it('Should succeed when stake by validator is at max cap', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const maxCap = oneToken.mul(1000);
    await contract.setValidatorMaxStake(maxCap);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await cqtContract.connect(validator1).approve(contract.address, maxCap);
    expect(await contract.connect(validator1).stake(0, maxCap))
        .to.emit(contract, 'Staked')
        .withArgs(0, validator1.address, maxCap);
  });
});
