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
  deposit,
} = require('../../fixtures');

describe('Set validator address', function() {
  it('Should change staking validator address.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.connect(opManager).setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    let details = await contract.getValidatorMetadata(0);
    expect(details._address).to.equal(VALIDATOR_1);

    await contract.connect(validator1).setValidatorAddress(0, OPERATOR_1);
    details = await contract.getValidatorMetadata(0);
    expect(details._address).to.equal(OPERATOR_1);
  });


  it('Should transfer rewards.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.connect(opManager).setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, oneToken.div(10));
    await stake(oneToken.mul(10), validator1, cqtContract, contract, 0)
    await deposit(contract, oneToken)
    await contract.connect(opManager).rewardValidators([0],[oneToken])
    let reward = oneToken.sub(oneToken.div(10))
    let details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
    expect(details.rewards).to.equal(reward);

    await contract.connect(validator1).setValidatorAddress(0, OPERATOR_1);
    details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
    expect(details.rewards).to.equal(0);

    details = await contract.getDelegatorMetadata(OPERATOR_1, 0)
    expect(details.rewards).to.equal(reward);
  });


  it('Should transfer stakings.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.connect(opManager).setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await stake(oneToken, validator1, cqtContract, contract, 0)
    let details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
    expect(details.staked).to.equal(oneToken);

    await contract.connect(validator1).setValidatorAddress(0, OPERATOR_1);
    details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
    expect(details.staked).to.equal(0);

    details = await contract.getDelegatorMetadata(OPERATOR_1, 0)
    expect(details.staked).to.equal(oneToken);
  });

  it('Should transfer unstakings.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.connect(opManager).setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await stake(oneToken.mul(30), validator1, cqtContract, contract, 0);
    await contract.connect(validator1).unstake(0, oneToken);
    await contract.connect(validator1).unstake(0, oneToken.mul(20));
    let details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
    expect(details.staked).to.equal(oneToken.mul(9));
    let cooldown1 = details.unstakingsEndEpochs[0]
    let cooldown2 = details.unstakingsEndEpochs[1]

    await contract.connect(validator1).setValidatorAddress(0, OPERATOR_1);
    details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
    expect(details.staked).to.equal(0);
    expect(details.unstakingAmounts.length).to.equal(0);
    expect(details.unstakingsEndEpochs.length).to.equal(0);

    details = await contract.getDelegatorMetadata(OPERATOR_1, 0)
    expect(details.staked).to.equal(oneToken.mul(9));
    expect(details.unstakingAmounts[0]).to.equal(oneToken);
    expect(details.unstakingAmounts[1]).to.equal(oneToken.mul(20));
    expect(details.unstakingsEndEpochs[0]).to.equal(cooldown1);
    expect(details.unstakingsEndEpochs[1]).to.equal(cooldown2);
  });

  it('Should emit ValidatorAddressChanged event with correct address.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    expect(await contract.connect(validator1).setValidatorAddress(0, OPERATOR_1))
    .to.emit(contract, 'ValidatorAddressChanged')
        .withArgs(1, OPERATOR_1);

    await addEnabledValidator(1, contract, opManager, VALIDATOR_2, 10);
    expect(await contract.connect(validator2).setValidatorAddress(1, OPERATOR_2))
    .to.emit(contract, 'ValidatorAddressChanged')
        .withArgs(1, OPERATOR_1);
  });


  it('Should not access setValidatorAddress by not validator.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);

    await expect(
        contract.connect(validator2).setValidatorAddress(0, OPERATOR_1)
    ).to.be.revertedWith("Sender is not the validator");

    await contract.connect(validator1).setValidatorAddress(0, OPERATOR_1)

    await expect(
        contract.connect(validator1).setValidatorAddress(0, OPERATOR_1)
    ).to.be.revertedWith("Sender is not the validator");
  });

  it('Should revert when transfer to a delegator.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.connect(opManager).setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, oneToken.div(10));
    await stake(oneToken.mul(10), validator1, cqtContract, contract, 0)
    await deposit(contract, oneToken.mul(10))
    await contract.connect(opManager).rewardValidators([0],[oneToken])
    let reward = oneToken.sub(oneToken.div(10))
    let details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
    expect(details.rewards).to.equal(reward);

    await stake(oneToken.mul(10), validator2, cqtContract, contract, 0)
    await contract.connect(opManager).rewardValidators([0],[oneToken])

    await expect(contract.connect(validator1).setValidatorAddress(0, VALIDATOR_2)).to.revertedWith("Cannot transfer validator address to a delegator");

  });

  // it('Should revert when transfer to a delegator with unstakings.', async function() {
  //   const [
  //     opManager,
  //     contract,
  //     cqtContract,
  //     validator1,
  //     validator2,
  //     delegator1,
  //     delegator2,
  //   ] = await getAll();
  //   await contract.connect(opManager).setStakingManagerAddress(opManager.address);
  //   await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
  //   await stake(oneToken, validator1, cqtContract, contract, 0)
  //   await stake(oneToken, validator2, cqtContract, contract, 0)
  //   let details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
  //   expect(details.staked).to.equal(oneToken);

  //   await expect(contract.connect(validator1).setValidatorAddress(0, VALIDATOR_2)).to.revertedWith("Cannot transfer validator address to a delegator");

  // });

  it('Should revert when transfer to a delegator with unstakings.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.connect(opManager).setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await stake(oneToken.mul(300), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(30), validator2, cqtContract, contract, 0);
    await contract.connect(validator1).unstake(0, oneToken.mul(2));
    await contract.connect(validator1).unstake(0, oneToken.mul(10));


    await contract.connect(validator2).unstake(0, oneToken);
    await contract.connect(validator2).unstake(0, oneToken.mul(20));

    let details = await contract.getDelegatorMetadata(VALIDATOR_1, 0)
    expect(details.staked).to.equal(oneToken.mul(288));
    let cooldown1 = details.unstakingsEndEpochs[0]
    let cooldown2 = details.unstakingsEndEpochs[1]

    let details2 = await contract.getDelegatorMetadata(VALIDATOR_2, 0)
    expect(details2.staked).to.equal(oneToken.mul(9));
    let cooldown3 = details2.unstakingsEndEpochs[0]
    let cooldown4 = details2.unstakingsEndEpochs[1]

    await expect(contract.connect(validator1).setValidatorAddress(0, VALIDATOR_2)).to.revertedWith("Cannot transfer validator to an address that has unstakings");

  });

  it('Should revert when the new address is 0.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await expect(
        contract.connect(validator1).setValidatorAddress(0, "0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("Invalid validator address");
  });

  it('Should revert when the new address is the old one.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await expect(
        contract.connect(validator1).setValidatorAddress(0, VALIDATOR_1)
    ).to.be.revertedWith("The new address cannot be equal to the current validator address");
  });

  it('Should revert when the validator id is invalid.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.setStakingManagerAddress(opManager.address);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await expect(
        contract.connect(validator1).setValidatorAddress(10, VALIDATOR_1)
    ).to.be.revertedWith("Invalid validator");
  });

});

