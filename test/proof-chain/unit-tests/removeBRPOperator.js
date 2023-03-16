const {
    setupDefaultOperators
  } = require('../../fixtures.js');
  const {expect} = require('chai');

  describe('Tests Governance control: removeBRPOperator()', function() {
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
        validatorID = validator1ID;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
      await proofChain.connect(owner).removeBRPOperator(operators[validator1ID].address);
    });

    it('Emits OperatorRemoved', async function() {
        validatorID = validator1ID;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
      await expect(proofChain.connect(owner).removeBRPOperator(operators[validator1ID].address))
          .to.emit(proofChain, 'OperatorRemoved')
          .withArgs(operators[0].address);
    });


    it('Does not let a non-governance role call removeBRPOperator()', async function() {
        validatorID = validator1ID;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
      await expect(
          proofChain.connect(operators[0]).removeBRPOperator(operators[validator1ID].address),
      ).to.be.revertedWith('Sender is not GOVERNANCE_ROLE');
    });

    it('Emits ValidatorDisabled on staking contract when count is 0', async function() {
        validatorID = validator1ID;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
            await proofChain.connect(validators[validator1ID]).enableBRPOperator(operators[validatorID].address);
      await expect(
          proofChain.connect(owner).removeBRPOperator(operators[validator1ID].address),
      ).to.emit(stakingContract, 'ValidatorDisabled');
    });

    it('Does not emit ValidatorDisabled on staking contract when count is > 0', async function() {
        validatorID = 0;
      await proofChain.connect(owner).addBRPOperator(delegators[0].address, 0);
      await proofChain.connect(validators[0]).enableBRPOperator(delegators[0].address);
      await expect(
          proofChain.connect(owner).removeBRPOperator(delegators[0].address),
      ).to.not.emit(stakingContract, 'ValidatorDisabled');
    });

    it('Removes brp role', async function() {
        validatorID = validator1ID;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
      await proofChain.connect(owner).removeBRPOperator(operators[validator1ID].address);
      await expect(await proofChain
            .connect(validators[validator1ID])
            .operatorRoles(
              operators[validator1ID].address)
            ).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it('Removes from brps', async function() {
        validatorID = validator1ID;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
            await proofChain.connect(validators[validator1ID]).enableBRPOperator(operators[validatorID].address);
      let brps = (await proofChain.getAllOperators())._brps
      expect(brps).to.contain(operators[validator1ID].address);
      await proofChain.connect(owner).removeBRPOperator(operators[validator1ID].address);
      brps = (await proofChain.getAllOperators())._brps
      expect(brps).to.not.contain(operators[validator1ID].address);
    });

    it('Removes operator from validator ids', async function() {
        validatorID = validator1ID;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
      await proofChain.connect(owner).removeBRPOperator(operators[validator1ID].address);
      await expect(await proofChain
            .connect(validators[validator1ID])
            .validatorIDs(
              operators[validator1ID].address)
            ).to.equal(0);
    });

    it('Should revert when trying to remove an operator that does not exist or has a different role', async function() {
        validatorID = validator1ID;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain.connect(owner).addBRPOperator(delegators[0].address, 0);
      await proofChain.connect(owner).addGovernor(delegators[1].address);
      await expect(proofChain
          .connect(owner)
          .removeBRPOperator(validators[0].address)).to.be.revertedWith('Operator does not perform the requested role');

          await expect(proofChain
              .connect(owner)
              .removeBRPOperator(delegators[1].address)).to.be.revertedWith('Operator does not perform the requested role');
    });

  });