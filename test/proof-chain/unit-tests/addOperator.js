const {
    getAllWithProofchain,
    BLOCK_SPECIMEN_PRODUCER_ROLE,
  } = require('../../fixtures.js');
  const {expect} = require('chai');

  describe('Tests addBSPOperator()', function() {
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

    it('Lets governance address add bsp operator', async function() {
      await proofChain
          .connect(owner)
          .addBSPOperator(validators[0].address, 0);
    });

    it('Emits OperatorAdded event', async function() {
      await expect(
        proofChain
        .connect(owner)
        .addBSPOperator(validators[0].address, 0)
      )
          .to.emit(proofChain, 'OperatorAdded')
          .withArgs(validators[0].address, 0, BLOCK_SPECIMEN_PRODUCER_ROLE);
    });

    it('Reverts when non-governance address preapproves an address for a role type', async function() {
      await expect(
          proofChain
              .connect(operators[1])
              .addBSPOperator(
                  validators[0].address,
                  0
              ),
      ).to.be.revertedWith('Sender is not GOVERNANCE_ROLE');
    });



    it('Reverts when adds the same operator twice', async function() {
      await proofChain
      .connect(owner)
      .addBSPOperator(
          validators[0].address,
          0
      )

      await expect(
          proofChain
              .connect(owner)
              .addBSPOperator(
                  validators[0].address,
                  0
              ),
      ).to.be.revertedWith('Operator already exists');

      await expect(
        proofChain
            .connect(owner)
            .addBSPOperator(
                validators[0].address,
                1
            ),
    ).to.be.revertedWith('Operator already exists');
    });

    it('Sets operators under correct validator', async function() {
      await proofChain
          .connect(owner)
          .addBSPOperator(validators[0].address, 0);

      let operators = await proofChain
        .connect(owner)
        .getOperators(0);

      expect(operators[0]).to.equal(validators[0].address);

      await proofChain
          .connect(owner)
          .addBSPOperator(validators[1].address, 0);

      operators = await proofChain
          .connect(owner)
          .getOperators(0);

      expect(operators[0]).to.equal(validators[0].address);
      expect(operators[1]).to.equal(validators[1].address);

      operators = await proofChain
          .connect(owner)
          .getOperators(1);

      expect(operators.length).to.equal(0);
    });

    it('Operator is disabled after being added', async function() {
      await proofChain
          .connect(owner)
          .addBSPOperator(validators[0].address, 0);

      expect( await proofChain
          .connect(owner)
          .isEnabled(validators[1].address)).to.equal(false);
    });


    it('Should set correct validator id', async function() {
      await proofChain
          .connect(owner)
          .addBSPOperator(validators[0].address, 0);

      expect( await proofChain
          .connect(owner)
          .operatorRoles(validators[0].address)).to.equal(BLOCK_SPECIMEN_PRODUCER_ROLE);

      await proofChain
          .connect(owner)
          .addBSPOperator(validators[1].address, 0);

      expect( await proofChain
          .connect(owner)
          .operatorRoles(validators[1].address)).to.equal(BLOCK_SPECIMEN_PRODUCER_ROLE);

        await proofChain
          .connect(owner)
          .addBSPOperator(validators[2].address, 1);

      expect( await proofChain
          .connect(owner)
          .operatorRoles(validators[2].address)).to.equal(BLOCK_SPECIMEN_PRODUCER_ROLE);
    });

    it('Should set correct operator role', async function() {
      await proofChain
          .connect(owner)
          .addBSPOperator(validators[0].address, 0);

      expect( await proofChain
          .connect(owner)
          .operatorRoles(validators[0].address)).to.equal(BLOCK_SPECIMEN_PRODUCER_ROLE);

      await proofChain
          .connect(owner)
          .addBSPOperator(validators[1].address, 0);

      expect( await proofChain
          .connect(owner)
          .operatorRoles(validators[1].address)).to.equal(BLOCK_SPECIMEN_PRODUCER_ROLE);

        await proofChain
          .connect(owner)
          .addBSPOperator(validators[2].address, 1);

      expect( await proofChain
          .connect(owner)
          .operatorRoles(validators[2].address)).to.equal(BLOCK_SPECIMEN_PRODUCER_ROLE);
    });

    it('Should set correct validator id', async function() {
      await proofChain
          .connect(owner)
          .addBSPOperator(validators[0].address, 0);

      expect( await proofChain
          .connect(owner)
          .validatorIDs(validators[0].address)).to.equal(0);

      await proofChain
          .connect(owner)
          .addBSPOperator(validators[1].address, 1);

      expect( await proofChain
          .connect(owner)
          .validatorIDs(validators[1].address)).to.equal(1);

        await proofChain
          .connect(owner)
          .addBSPOperator(validators[2].address, 0);

      expect( await proofChain
          .connect(owner)
          .validatorIDs(validators[2].address)).to.equal(0);
    });

  });
