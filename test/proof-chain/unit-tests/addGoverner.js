const {
    getAllWithProofchain
  } = require('../../fixtures.js');
  const {expect} = require('chai');
const { GOVERNANCE_ROLE } = require('../../fixtures.js');

  describe('Tests addGovernor()', function() {
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

    it('Lets owner add a governor and emits OperatorAdded event with correct args', async function() {
      await expect(proofChain
          .connect(owner)
          .addGovernor(validators[0].address))
          .to.emit(proofChain, 'OperatorAdded')
           .withArgs(validators[0].address, 0, GOVERNANCE_ROLE);
    });


    it('Reverts when non-owner address adds a governor', async function() {
      await expect(
          proofChain
              .connect(operators[1])
              .addGovernor(
                  validators[0].address
              ),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });


    it('Should set correct role', async function() {
      await proofChain.connect(owner).addGovernor(validators[0].address)

      expect( await proofChain
          .connect(owner)
          .operatorRoles(validators[0].address)).to.equal(GOVERNANCE_ROLE);
    });

    it('Should be able to add multiple governors', async function() {
      await proofChain.connect(owner).addGovernor(validators[0].address)
      await proofChain.connect(owner).addGovernor(validators[1].address)

      expect( await proofChain
            .connect(owner)
            .operatorRoles(validators[0].address)).to.equal(GOVERNANCE_ROLE);

      expect( await proofChain
              .connect(owner)
              .operatorRoles(validators[1].address)).to.equal(GOVERNANCE_ROLE);
    });

    it('Should revert when trying to add a governor who is an operator', async function() {
      await proofChain
          .connect(owner)
          .addBSPOperator(validators[0].address, 0);


          await expect(
                  proofChain
                      .connect(owner)
                      .addGovernor(
                        validators[0].address
                      ),
              ).to.be.revertedWith('Operator already exists');
    });

  });
