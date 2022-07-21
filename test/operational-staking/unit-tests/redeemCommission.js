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

describe('Redeem Commission', function() {
  it('Should CommissionRewardRedeemed event with correct number of rewards when there are no delegators', async function() {
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
        .redeemAllCommission(0, validator1.address);
    await expect(res1)
        .to.emit(contract, 'CommissionRewardRedeemed')
        .withArgs(0, validator1.address, v1GivenCommission);

    const res2 = await contract
        .connect(validator2)
        .redeemAllCommission(1, validator2.address);
    await expect(res2)
        .to.emit(contract, 'CommissionRewardRedeemed')
        .withArgs(1, validator2.address, v2GivenCommission);
  });

  it('Should emit CommissionRewardRedeemed event with correct number of rewards when there are delegators', async function() {
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
        .redeemAllCommission(0, validator1.address);
    await expect(res1)
        .to.emit(contract, 'CommissionRewardRedeemed')
        .withArgs(0, validator1.address, v1GivenCommission);

    const res2 = await contract
        .connect(validator2)
        .redeemAllCommission(1, validator2.address);

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
    await contract.connect(validator1).redeemAllCommission(0, validator1.address);
    expect(await cqtContract.balanceOf(VALIDATOR_1)).to.equal(
        oldOwnerBalance.add(v1GivenCommission),
    );
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.sub(v1GivenCommission),
    );

    oldOwnerBalance = await cqtContract.balanceOf(VALIDATOR_2);
    oldContractBalance = await cqtContract.balanceOf(contract.address);
    await contract.connect(validator2).redeemAllCommission(1, validator2.address);
    expect(await cqtContract.balanceOf(VALIDATOR_2)).to.equal(
        oldOwnerBalance.add(v2GivenCommission),
    );
    expect(await cqtContract.balanceOf(contract.address)).to.equal(
        oldContractBalance.sub(v2GivenCommission),
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

    await expect(
        contract.connect(validator1).redeemCommission(0, validator1.address, tokensGiven2.mul(10000)),
    ).to.revertedWith("Requested amount is higher than commission available to redeem");

    await expect(
      contract.connect(validator1).redeemCommission(0, validator1.address, 0),
    ).to.revertedWith('The requested amount is 0');

    await contract.connect(validator1).redeemAllCommission(0, validator1.address);
    await expect(
        contract.connect(validator1).redeemAllCommission(0, validator1.address),
    ).to.revertedWith('No commission available to redeem');
    await expect(
        contract.connect(validator1).redeemCommission(0, validator1.address, 1),
    ).to.revertedWith('No commission available to redeem');

    await contract.connect(validator2).redeemAllCommission(1, validator2.address);
    await expect(
        contract.connect(validator2).redeemAllCommission(1, validator2.address),
    ).to.revertedWith('No commission available to redeem');
    await expect(
        contract.connect(validator2).redeemCommission(1, validator2.address, 1),
    ).to.revertedWith('No commission available to redeem');
  });

  it('Should revert with invalid beneficiary when trying to redeem some commmission', async function() {
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
            .redeemCommission(0, '0x0000000000000000000000000000000000000000', 1),
    ).to.revertedWith('Invalid beneficiary');
  });


  it('Should revert with invalid beneficiary when trying to redeem all commmission', async function() {
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
            .redeemAllCommission(0, '0x0000000000000000000000000000000000000000'),
    ).to.revertedWith('Invalid beneficiary');
  });

  it('Should revert with invalid validator when trying to redeem', async function() {
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
            .redeemCommission(1, '0x0000000000000000000000000000000000000000', 1),
    ).to.revertedWith('Invalid validator');
  });


  it('Should revert with invalid validator when trying to redeem', async function() {
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
            .redeemAllCommission(1, '0x0000000000000000000000000000000000000000'),
    ).to.revertedWith('Invalid validator');
  });


  it('Should revert when delegator trying to redeem some commission', async function() {
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
            .connect(delegator1)
            .redeemCommission(0, delegator1.address, 1),
    ).to.revertedWith('The sender is not the validator');
  });


  it('Should revert when delegator trying to redeem all commission', async function() {
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
            .connect(delegator1)
            .redeemAllCommission(0, delegator1.address),
    ).to.revertedWith('The sender is not the validator');
  });


});



// function redeemCommission(uint128 validatorId, address beneficiary, uint128 amount) public {


//     require(amount <= v.commissionAvailableToRedeem, "Nothing to redeem");
//     v.commissionAvailableToRedeem -= amount;

// require(amount <= v.commissionAvailableToRedeem, "Requested amount is higher than commission available to redeem");
// v.commissionAvailableToRedeem -= amount;

//     _transferFromContract(beneficiary, amount);
//     emit CommissionRewardRedeemed(validatorId, beneficiary, amount);
// }