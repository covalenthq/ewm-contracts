const {
  setupDefaultOperators
} = require('../../fixtures.js');
const {expect} = require('chai');

describe('Tests Governance control: removeBSPOperator()', function() {
  beforeEach(async function() {
    [contractsAndAccounts, parameters] = await setupDefaultOperators();

    [
      owner,
      stakingContract,
      cqtContract,
      proofChain,
      validators,
      operators,
      delegators,
    ] = contractsAndAccounts;


    validator1ID = 0;
    validator2ID = 1;
    validator3ID = 2;

  });

  it('Lets Governance remove an operator', async function() {
    await proofChain.connect(owner).removeBSPOperator(operators[validator1ID].address);
  });

  it('Emits OperatorRemoved', async function() {
    await expect(proofChain.connect(owner).removeBSPOperator(operators[validator1ID].address))
        .to.emit(proofChain, 'OperatorRemoved')
        .withArgs(operators[0].address);
  });


  it('Does not let a non-governance role call removeBSPOperator()', async function() {
    await expect(
        proofChain.connect(operators[0]).removeBSPOperator(operators[validator1ID].address),
    ).to.be.revertedWith('Sender is not GOVERNANCE_ROLE');
  });

  it('Emits ValidatorDisabled on staking contract when count is 0', async function() {
    await expect(
        proofChain.connect(owner).removeBSPOperator(operators[validator1ID].address),
    ).to.emit(stakingContract, 'ValidatorDisabled');
  });

  it('Does not emit ValidatorDisabled on staking contract when count is > 0', async function() {
    await proofChain.connect(owner).addBSPOperator(delegators[0].address, 0);
    await proofChain.connect(validators[0]).enableBSPOperator(delegators[0].address);
    await expect(
        proofChain.connect(owner).removeBSPOperator(operators[0].address),
    ).to.not.emit(stakingContract, 'ValidatorDisabled');
  });

  it('Removes bsp role', async function() {
    await proofChain.connect(owner).removeBSPOperator(operators[validator1ID].address);
    await expect(await proofChain
          .connect(validators[validator1ID])
          .operatorRoles(
            operators[validator1ID].address)
          ).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  it('Removes from bsps', async function() {
    let bsps = (await proofChain.getAllOperators())._bsps
    expect(bsps).to.contain(operators[validator1ID].address);
    await proofChain.connect(owner).removeBSPOperator(operators[validator1ID].address);
    bsps = (await proofChain.getAllOperators())._bsps
    expect(bsps).to.not.contain(operators[validator1ID].address);
  });

  it('Removes operator from validator ids', async function() {
    await proofChain.connect(owner).removeBSPOperator(operators[validator1ID].address);
    await expect(await proofChain
          .connect(validators[validator1ID])
          .validatorIDs(
            operators[validator1ID].address)
          ).to.equal(0);
  });

  it('Should revert when trying to remove an operator that does not exist or has a different role', async function() {
    await proofChain.connect(owner).addBSPOperator(delegators[0].address, 0);
    await proofChain.connect(owner).addGovernor(delegators[1].address);
    await expect(proofChain
        .connect(owner)
        .removeBSPOperator(validators[0].address)).to.be.revertedWith('Operator does not perform the requested role');

        await expect(proofChain
            .connect(owner)
            .removeBSPOperator(delegators[1].address)).to.be.revertedWith('Operator does not perform the requested role');
  });

});