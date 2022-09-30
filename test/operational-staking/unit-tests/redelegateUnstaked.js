const {expect} = require('chai');
const {ethers} = require('hardhat');

const {
  stake,
  deposit,
  getAll,
  mineBlocks,
  getOwner,
  getDeployedContractsDefault,
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

describe('Redelegate Unstaked', function() {
  it('Should redelegate partially and emit Redelegated and Staked events', async function() {
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
    await contract.connect(opManager).setMaxCapMultiplier(10);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0);
    await contract.connect(opManager).disableValidator(0, 1);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);

    const amountIn = oneToken.mul(7000);
    await contract.connect(delegator1).unstake(0, amountIn);
    let res = await contract
        .connect(delegator1)
        .redelegateUnstaked(amountIn.sub(oneToken.mul(1)), 0, 1, 0);
    expect(res)
        .to.emit(contract, 'Redelegated')
        .withArgs(
            0,
            1,
            delegator1.address,
            amountIn.sub(oneToken.mul(1)).toString(),
            0,
        );
    expect(res)
        .to.emit(contract, 'Staked')
        .withArgs(
            1,
            delegator1.address,
            amountIn.sub(oneToken.mul(1)).toString(),
        );

    await mineBlocks(100);
    res = await contract
        .connect(delegator1)
        .redelegateUnstaked(oneToken.mul(1), 0, 1, 0);
    expect(res)
        .to.emit(contract, 'Redelegated')
        .withArgs(0, 1, delegator1.address, oneToken.mul(1).toString(), 0);
    expect(res)
        .to.emit(contract, 'Staked')
        .withArgs(1, delegator1.address, oneToken.mul(1).toString());
  });

  it('Should redelegate fully and emit event', async function() {
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
    await contract.connect(opManager).setMaxCapMultiplier(10);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0);
    await contract.connect(opManager).disableValidator(0, 1);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);

    const amountIn = oneToken.mul(7000);
    await contract.connect(delegator1).unstake(0, amountIn);

    expect(
        await contract.connect(delegator1).redelegateUnstaked(amountIn, 0, 1, 0),
    )
        .to.emit(contract, 'Redelegated')
        .withArgs(0, 1, delegator1.address, amountIn, 0);
  });

  it('Should not be able to redelegate the same unstake fully twice', async function() {
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
    await contract.connect(opManager).setMaxCapMultiplier(10);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0);
    await contract.connect(opManager).disableValidator(0, 1);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);
    const amountIn = oneToken.mul(7000);
    await contract.connect(delegator1).unstake(0, amountIn);
    await contract.connect(delegator1).redelegateUnstaked(amountIn, 0, 1, 0);
    await expect(
        contract.connect(delegator1).redelegateUnstaked(amountIn, 0, 1, 0),
    ).to.revertedWith('Unstaking has less tokens');
  });

  it('Should change number of staked tokens under new validator', async function() {
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
    await contract.connect(opManager).setMaxCapMultiplier(10);
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0);
    await contract.connect(opManager).disableValidator(0, 1);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);
    const amountIn = oneToken.mul(7000);
    await contract.connect(delegator1).unstake(0, amountIn);
    await contract.connect(delegator1).redelegateUnstaked(amountIn, 0, 1, 0);

    const staked = (await contract.getDelegatorMetadata(delegator1.address, 1))
        .staked;
    await expect(staked).to.equal(amountIn);
  });

  it('Should revert when redelegating with enabled validator', async function() {
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
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(2000), delegator1, cqtContract, contract, 0);
    await mineBlocks(100);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);
    const amountIn = oneToken.mul(2000);
    await contract.connect(delegator1).unstake(0, amountIn);
    await expect(
        contract.connect(delegator1).redelegateUnstaked(amountIn, 0, 1, 0),
    ).to.revertedWith('Validator is not disabled');
  });

  it('Should revert when validators attempt to redelegate', async function() {
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
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(2000), delegator1, cqtContract, contract, 0);
    await mineBlocks(100);
    await contract.disableValidator(0, 1);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amountIn = oneToken.mul(2000);
    await stake(amount, validator1, cqtContract, contract, 1);
    await contract.connect(delegator1).unstake(0, amountIn);
    await expect(
        contract.connect(validator1).redelegateUnstaked(amountIn, 0, 1, 0),
    ).to.revertedWith('Validator cannot redelegate');
  });

  it('Should revert when redelegate greater than unstake', async function() {
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
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(1500), delegator1, cqtContract, contract, 0);
    await mineBlocks(100);
    await contract.disableValidator(0, 1);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amountIn = oneToken.mul(1000);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);
    await contract.connect(delegator1).unstake(0, amountIn);
    await expect(
        contract.connect(delegator1).redelegateUnstaked(amountIn.add(1), 0, 1, 0),
    ).to.revertedWith('Unstaking has less tokens');
  });

  it('Should revert when redelegating from invalid validator', async function() {
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
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(1500), delegator1, cqtContract, contract, 0);
    await mineBlocks(100);
    await contract.disableValidator(0, 1);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amountIn = oneToken.mul(1000);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);
    await contract.connect(delegator1).unstake(0, amountIn);
    await expect(
        contract.connect(delegator1).redelegateUnstaked(amountIn.add(1), 10, 1, 0),
    ).to.revertedWith('Invalid validator');
  });

  it('Should revert when redelegating invalid unstaking', async function() {
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
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(1500), delegator1, cqtContract, contract, 0);
    await mineBlocks(100);
    await contract.disableValidator(0, 1);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amountIn = oneToken.mul(1000);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);
    await contract.connect(delegator1).unstake(0, amountIn);
    await expect(
        contract.connect(delegator1).redelegateUnstaked(amountIn.add(1), 0, 1, 10),
    ).to.revertedWith('Unstaking does not exist');
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
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );

    await cqtContract
        .connect(validator1)
        .approve(contract.address, oneToken.mul(2000));
    await contract.connect(validator1).stake(0, oneToken.mul(1000));
    await contract.connect(validator1).stake(1, oneToken.mul(1000));

    await cqtContract
        .connect(delegator1)
        .approve(contract.address, oneToken.mul(2));
    await contract.connect(delegator1).stake(0, oneToken);
    await contract.connect(delegator1).stake(1, oneToken);

    await contract.connect(opManager).disableValidator(0, 1);
    await contract.connect(delegator1).unstake(0, oneToken);

    const oldContractBalance = await cqtContract.balanceOf(contract.address);
    await contract.connect(delegator1).redelegateUnstaked(oneToken, 0, 1, 0);

    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance,
    );
  });

  it('Should revert when redelegating from enabled validator that was disabled', async function() {
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
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(2000), delegator1, cqtContract, contract, 0);
    await mineBlocks(100);
    await addEnabledValidator(
        1,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    await stake(amount, validator1, cqtContract, contract, 1);
    const amountIn = oneToken.mul(2000);
    await contract.connect(delegator1).unstake(0, amountIn);
    await contract.connect(opManager).disableValidator(0, 1);
    await contract.connect(opManager).enableValidator(0);
    await expect(
        contract.connect(delegator1).redelegateUnstaked(amountIn, 0, 1, 0),
    ).to.revertedWith('Validator is not disabled');
  });
});
