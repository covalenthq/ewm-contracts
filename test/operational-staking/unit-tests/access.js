const {expect} = require('chai');
const {
  getAll,
  getDeployedContractsDefault,
  oneToken,
  OWNER,
  VALIDATOR_1,
  VALIDATOR_2,
  stake,
  deposit,
  getOwner
} = require('../../fixtures');

describe('Ownership', function() {
  it('Should return owner address same as signer.', async function() {
    const [opManager, contract] = await getDeployedContractsDefault();
    expect(await contract.owner()).to.equal(OWNER);
  });

  it('Should access depositRewards, takeOutRewardTokens, setMaxCapMultiplier by owner.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    contract.setStakingManagerAddress(validator1.address);
    await cqtContract.approve(contract.address, oneToken);
    await expect(contract.depositRewardTokens(oneToken))
        .to.emit(contract, 'RewardTokensDeposited')
        .withArgs(oneToken.toString());
    await expect(contract.takeOutRewardTokens(oneToken))
        .to.emit(contract, 'AllocatedTokensTaken')
        .withArgs(oneToken.toString());

    await contract.setStakingManagerAddress(OWNER);
    await contract.addValidator(VALIDATOR_1, oneToken.div(10));
    await contract.setMaxCapMultiplier(8);
    await contract.setValidatorMaxStake(oneToken);

    await expect(contract.setStakingManagerAddress(VALIDATOR_2))
        .to.emit(contract, 'StakingManagerAddressChanged')
        .withArgs(VALIDATOR_2);
  });

  it('Should not access depositRewards, takeOutRewardTokens, addValidator by not owner.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const ownableMessage = 'Ownable: caller is not the owner';
    await expect(
        contract.connect(validator1).depositRewardTokens(100),
    ).to.be.revertedWith(ownableMessage);
    await expect(
        contract.connect(validator1).takeOutRewardTokens(100),
    ).to.be.revertedWith(ownableMessage);
    await expect(
        contract.connect(validator1).setStakingManagerAddress(validator1.address),
    ).to.be.revertedWith(ownableMessage);

    await expect(
        contract.connect(validator2).depositRewardTokens(oneToken),
    ).to.be.revertedWith(ownableMessage);
    await expect(
        contract.connect(validator2).takeOutRewardTokens(oneToken),
    ).to.be.revertedWith(ownableMessage);
    await expect(
        contract.connect(validator2).setStakingManagerAddress(delegator1.address),
    ).to.be.revertedWith(ownableMessage);
  });

  it('Should access rewardValidator, addValidator by proofChain.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.setStakingManagerAddress(validator1.address);

    await expect(
        contract
            .connect(validator1)
            .addValidator(validator1.address, oneToken.div(10)),
    )
        .to.emit(contract, 'ValidatorAdded')
        .withArgs(0, oneToken.div(10).toString(), VALIDATOR_1);
    await stake(oneToken.mul(100), validator1, cqtContract, contract, 0);
    await deposit(contract, oneToken.mul(1000));
    await contract.connect(validator1).rewardValidators([0], [oneToken.mul(100)]),

    await expect(contract.connect(validator1).disableValidator(0, 1000))
        .to.emit(contract, 'ValidatorDisabled')
        .withArgs(0, 1000);
    await expect(
        contract
            .connect(await getOwner())
            .setValidatorCommissionRate(0, oneToken.div(20)),
    )
        .to.emit(contract, 'ValidatorCommissionRateChanged')
        .withArgs('0', oneToken.div(20).toString());
  });

  it('Should not access rewardValidator, addValidator by not proofChain.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const proofChainMessage = 'Caller is not stakingManager';
    await contract.setStakingManagerAddress(delegator1.address);
    await expect(
        contract.connect(validator1).rewardValidators([0], [100]),
    ).to.be.revertedWith(proofChainMessage);
    await expect(
        contract.connect(validator1).addValidator(validator1.address, oneToken),
    ).to.be.revertedWith(proofChainMessage);
    await expect(
        contract.connect(validator1).disableValidator(0, 0),
    ).to.be.revertedWith(proofChainMessage);
    await expect(
        contract
            .connect(validator1)
            .setValidatorCommissionRate(0, oneToken.div(10)),
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
        contract.connect(validator2).rewardValidators([2], [oneToken]),
    ).to.be.revertedWith(proofChainMessage);
    await expect(
        contract.connect(validator2).addValidator(validator2.address, oneToken),
    ).to.be.revertedWith(proofChainMessage);
    await expect(
        contract.connect(validator2).disableValidator(100, 1),
    ).to.be.revertedWith(proofChainMessage);
    await expect(
        contract
            .connect(validator2)
            .setValidatorCommissionRate(oneToken.div(5), 0),
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it('Should not access internal functions.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    expect(() => contract._transferToContract(VALIDATOR_1, oneToken)).to.throw(
        'contract._transferToContract is not a function',
    );
    expect(() =>
      contract._transferFromContract(VALIDATOR_1, oneToken),
    ).to.throw('contract._transferFromContract is not a function');
    expect(() => contract._sharesToTokens(oneToken, oneToken)).to.throw(
        'contract._sharesToTokens is not a function',
    );
    expect(() => contract._tokensToShares(oneToken, oneToken)).to.throw(
        'contract._tokensToShares is not a function',
    );
    expect(() => contract._stake(0, oneToken)).to.throw(
        'contract._stake is not a function',
    );
    expect(() => contract._redeemRewards(1, VALIDATOR_2, oneToken)).to.throw(
        'contract._redeemRewards is not a function',
    );
  });
});
