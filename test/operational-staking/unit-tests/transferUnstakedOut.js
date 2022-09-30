const {expect} = require('chai');
const {ethers} = require('hardhat');

const {
  stake,
  deposit,
  getAllWithCoolDown,
  mineBlocks,
  getOwner,
  oneToken,
  OWNER,
  VALIDATOR_1,
  VALIDATOR_2,
  OPERATOR_1,
  CQT_ETH_MAINNET,
  OPERATOR_2,
  DELEGATOR_1,
  DELEGATOR_2,
  CQT,
  addEnabledValidator,
} = require('../../fixtures');

describe('Transfer Unstaked', function() {
  it('Should transfer out after cool down ends, delegator', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 500;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(10000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator2, cqtContract, contract, 0);
    await mineBlocks(100);
    let amountIn = oneToken.mul(7000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    expect(
        await contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator2.address, amountIn.toString());

    amountIn = oneToken.mul(1000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    expect(
        await contract.connect(validator2).transferUnstakedOut(amountIn, 0, 1),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator2.address, amountIn.toString());
  });

  it('Should transfer out after cool down ends, validator', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 500;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(10000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator1, cqtContract, contract, 0);
    await mineBlocks(100);
    let amountIn = oneToken.mul(7000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(500);
    expect(
        await contract.connect(validator1).transferUnstakedOut(amountIn, 0, 0),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator1.address, amountIn.toString());

    amountIn = oneToken.mul(1000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(500);
    expect(
        await contract.connect(validator1).transferUnstakedOut(amountIn, 0, 1),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator1.address, amountIn.toString());
  });

  it('Should transfer out partially', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 500;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(10000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator1, cqtContract, contract, 0);
    await mineBlocks(100);
    const amountIn = oneToken.mul(7000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(500);
    expect(
        await contract
            .connect(validator1)
            .transferUnstakedOut(amountIn.div(2), 0, 0),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator1.address, amountIn.div(2).toString());
    expect(
        await contract
            .connect(validator1)
            .transferUnstakedOut(amountIn.div(2), 0, 0),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator1.address, amountIn.div(2).toString());
  });

  it('Should change balance of the contract and the owner.', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 500;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(10000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator2, cqtContract, contract, 0);
    await mineBlocks(100);

    let amountIn = oneToken.mul(7000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    let oldContractBalance = await cqtContract.balanceOf(contract.address);
    let oldStakerBalance = await cqtContract.balanceOf(validator2.address);
    expect(
        await contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator2.address, amountIn.toString());
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.sub(amountIn),
    );
    expect(await cqtContract.balanceOf(validator2.address)).to.equal(
        oldStakerBalance.add(amountIn),
    );

    amountIn = oneToken.mul(1000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    oldContractBalance = await cqtContract.balanceOf(contract.address);
    oldStakerBalance = await cqtContract.balanceOf(validator2.address);
    expect(
        await contract.connect(validator2).transferUnstakedOut(amountIn, 0, 1),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator2.address, amountIn.toString());
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.sub(amountIn),
    );
    expect(await cqtContract.balanceOf(validator2.address)).to.equal(
        oldStakerBalance.add(amountIn),
    );
  });

  it('Should transfer out after cool down ends, validator', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 500;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(8000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator1, cqtContract, contract, 0);
    await mineBlocks(500);
    let amountIn = oneToken.mul(7000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(500);
    expect(
        await contract.connect(validator1).transferUnstakedOut(amountIn, 0, 0),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator1.address, amountIn.toString());

    amountIn = oneToken.mul(1000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(500);
    expect(
        await contract.connect(validator1).transferUnstakedOut(amountIn, 0, 1),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator1.address, amountIn.toString());
  });

  it('Should revert with wrong unstaking id', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 500;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator2, cqtContract, contract, 0);
    await mineBlocks(100);
    let amountIn = oneToken.mul(7000);
    await expect(
        contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    ).to.revertedWith('Unstaking does not exist');
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator2).transferUnstakedOut(amountIn, 0, 1),
    ).to.revertedWith('Unstaking does not exist');
    amountIn = oneToken.mul(1000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator2).transferUnstakedOut(amountIn, 0, 2),
    ).to.revertedWith('Unstaking does not exist');
  });

  it('Should revert when the transfer amount is higher than unstaked', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 500;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator2, cqtContract, contract, 0);
    await mineBlocks(100);
    let amountIn = oneToken.mul(7000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    expect(
        await contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator2.address, amountIn.toString());
    amountIn = oneToken.mul(1000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    ).to.revertedWith('Amount is too high');
  });

  it('Should revert when trying to attempt transfer the same unstake twice', async function() {
    const delegatorCoolDown = 1;
    const validatorCoolDown = 5;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator2, cqtContract, contract, 0);
    await mineBlocks(100);
    const amountIn = oneToken.mul(7000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    expect(
        await contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    )
        .to.emit(contract, 'UnstakeRedeemed')
        .withArgs(0, validator2.address, amountIn.toString());
    await expect(
        contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    ).to.revertedWith('Amount is too high');
  });

  it('Should revert when cool down did not end, delegator', async function() {
    const delegatorCoolDown = 1000;
    const validatorCoolDown = 5000;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator2, cqtContract, contract, 0);
    await mineBlocks(100);
    let amountIn = oneToken.mul(7000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    ).to.revertedWith('Cooldown period has not ended');
    amountIn = oneToken.mul(1000);
    await contract.connect(validator2).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator2).transferUnstakedOut(amountIn, 0, 0),
    ).to.revertedWith('Cooldown period has not ended');
  });

  it('Should revert when cool down did not end, validator', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 5000;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator1, cqtContract, contract, 0);
    await mineBlocks(100);
    let amountIn = oneToken.mul(7000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator1).transferUnstakedOut(amountIn, 0, 0),
    ).to.revertedWith('Cooldown period has not ended');
    amountIn = oneToken.mul(1000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator1).transferUnstakedOut(amountIn, 0, 0),
    ).to.revertedWith('Cooldown period has not ended');
  });


  it('Should revert when given invalid validator id', async function() {
    const delegatorCoolDown = 100;
    const validatorCoolDown = 5000;
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAllWithCoolDown(
        CQT_ETH_MAINNET,
        delegatorCoolDown,
        validatorCoolDown,
        10,
        oneToken.mul(100000),
    );
    deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        1000000000000,
    );
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(8000), validator1, cqtContract, contract, 0);
    await mineBlocks(100);
    let amountIn = oneToken.mul(7000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator1).transferUnstakedOut(amountIn, 100, 0),
    ).to.revertedWith('Invalid validator');
    amountIn = oneToken.mul(1000);
    await contract.connect(validator1).unstake(0, amountIn);
    await mineBlocks(100);
    await expect(
        contract.connect(validator1).transferUnstakedOut(amountIn, 10, 0),
    ).to.revertedWith('Invalid validator');
  });
});
