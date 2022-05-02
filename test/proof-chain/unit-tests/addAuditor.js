const {
    getAllWithProofchain,
    AUDITOR_ROLE,
  } = require('../../fixtures.js');
  const {expect} = require('chai');

  describe('Tests addAuditor()', function() {

    beforeEach(async function() {
      [
        owner,
        stakingContract,
        cqtContract,
        proofChain,
        validators,
        operators,
        delegators,
      ] = await getAllWithProofchain();
    });

    it('Lets governor add an auditor and emits OperatorAdded event with correct args', async function() {
      await expect(proofChain
          .connect(owner)
          .addAuditor(validators[0].address))
          .to.emit(proofChain, 'OperatorAdded')
           .withArgs(validators[0].address, 0, AUDITOR_ROLE);
    });


    it('Reverts when non-governance address adds an auditor', async function() {
      await expect(
          proofChain
              .connect(operators[1])
              .addAuditor(
                  validators[0].address
              ),
      ).to.be.revertedWith('Sender is not GOVERNANCE_ROLE');
    });


    it('Should set correct role', async function() {
      await proofChain.connect(owner).addAuditor(validators[0].address)

      expect( await proofChain
          .connect(owner)
          .operatorRoles(validators[0].address)).to.equal(AUDITOR_ROLE);
    });

    it('Should be able to add multiple auditors', async function() {
      await proofChain.connect(owner).addAuditor(validators[0].address)
      await proofChain.connect(owner).addAuditor(validators[1].address)

      expect( await proofChain
            .connect(owner)
            .operatorRoles(validators[0].address)).to.equal(AUDITOR_ROLE);

      expect( await proofChain
              .connect(owner)
              .operatorRoles(validators[1].address)).to.equal(AUDITOR_ROLE);
    });

    it('Should revert when trying to add auditor who is an operator', async function() {
      await proofChain
          .connect(owner)
          .addBSPOperator(validators[0].address, 0);


          await expect(
                  proofChain
                      .connect(owner)
                      .addAuditor(
                        validators[0].address
                      ),
              ).to.be.revertedWith('Operator already exists');
    });

  });
