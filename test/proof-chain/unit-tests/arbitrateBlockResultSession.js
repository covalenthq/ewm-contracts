const {
    setupDefaultOperators,
    oneToken,
    mineBlocks,
    getHash
  } = require('../../fixtures.js');
  const {expect} = require('chai');
  const createKeccakHash = require('keccak');

  describe('Block Result Arbitration Tests', function() {
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
      [
        rewardPool,
        maxCapMultiplier,
        maxStakeLimit,
        bspStakeRequired,
        blockSpecimenReward,
        specimenQuorumThreshold,
      ] = parameters;

      numOperators = operators.length;
      quorumThreshold = Math.floor(
          (numOperators *
          ((await proofChain
              .connect(owner).getMetadata())
              .blockSpecimenQuorum)) /
          10 ** 18,
      );
      for(let i = 0; i<operators.length; i++){
        await proofChain.connect(owner).removeBSPOperator(operators[i].address);
        await proofChain.connect(owner).addBRPOperator(operators[i].address, i);
        await proofChain.connect(validators[i]).enableBRPOperator(operators[i].address);
      }

      chainId = 1;
      blockHeight = 123;
      specimenSize = 15;
      specimenLength = 1;
      storageURL = 'example.com';
      specimenHash = getHash('main specimen')
      altHash = getHash('alternate specimen')
      sessionDuration = (await proofChain.connect(owner).getMetadata()).blockSpecimenSessionDuration;
    });

    it('Reverts if non AUDITOR_ROLE to call the function', async function() {
      await expect(
          proofChain
              .connect(delegators[0])
              .arbitrateBlockResultSession(chainId, blockHeight, specimenHash, specimenHash),
      ).to.be.revertedWith('Sender is not AUDITOR_ROLE');
    });



    it('Reverts if the block result session has not started', async function() {
      notStartedBlockHeight = 9999999999;
      await proofChain.connect(owner).addAuditor(delegators[1].address)
      await expect(
          proofChain
              .connect(delegators[1])
              .arbitrateBlockResultSession(
                  chainId,
                  notStartedBlockHeight,
                  specimenHash,
                  specimenHash
              ),
      ).to.be.revertedWith('Session must be finalized before audit');
    });

    it('Reverts if the deadline has not been reached', async function() {

      await expect(
          proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              ),
      )
          .to.emit(proofChain, 'BlockResultProductionProofSubmitted');
          await proofChain.connect(owner).addAuditor(delegators[1].address)
      await expect(
          proofChain
              .connect(delegators[1])
              .arbitrateBlockResultSession(chainId, blockHeight, specimenHash, specimenHash),
      ).to.be.revertedWith('Session must be finalized before audit');
    });



    it('Reverts when arbitration happens before finalize', async function() {
      newSessionDuration = 20;
      await proofChain
          .connect(owner)
          .setSessionDuration(newSessionDuration);

      await proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              )

      await mineBlocks(newSessionDuration + 1);

      await proofChain.connect(owner).addAuditor(delegators[1].address)

      await expect(proofChain
          .connect(delegators[1])
          .arbitrateBlockResultSession(chainId, blockHeight, specimenHash, specimenHash)
          ).to.be.revertedWith('Session must be finalized before audit');
    });

    it('Allows arbitration after finalize', async function() {
      newSessionDuration = 20;
      await proofChain
          .connect(owner)
          .setSessionDuration(newSessionDuration);

      await proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              )

      await mineBlocks(newSessionDuration + 1);

      await proofChain.finalizeAndRewardBlockResultSession(chainId, blockHeight)

      await proofChain.connect(owner).addAuditor(delegators[1].address)

      await expect(proofChain
          .connect(delegators[1])
          .arbitrateBlockResultSession(chainId, blockHeight, specimenHash, specimenHash)
          ).to.emit(proofChain, 'BlockResultRewardAwarded')
          .withArgs(chainId, blockHeight, specimenHash, specimenHash);
    });

    it('Emits BlockSpecimenSessionFinalized after deadline arbitration ', async function() {
      newSessionDuration = 20;
      await proofChain
          .connect(owner)
          .setSessionDuration(newSessionDuration);

      await expect(
          proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              ),
      )
          .to.emit(proofChain, 'BlockResultProductionProofSubmitted')

      await mineBlocks(newSessionDuration + 1);

      await proofChain.connect(owner).addAuditor(delegators[1].address)

      await proofChain.finalizeAndRewardBlockResultSession(chainId, blockHeight)

      await expect(
          proofChain
              .connect(delegators[1])
              .arbitrateBlockResultSession(chainId, blockHeight, specimenHash, specimenHash),
      ).to.emit(proofChain, 'BlockResultRewardAwarded');
    });



    it('Should emit BlockResultRewardAwarded with correct args when quorum not reached', async function() {
        await proofChain.connect(owner).setSessionDuration(10);
        await proofChain.connect(owner).addAuditor(delegators[1].address)

        for (i = 0; i < 3; i++) {
          await proofChain.connect(operators[i])
                .submitBlockResultProof(
                    chainId,
                    blockHeight,
                    specimenHash,
                    specimenHash,
                    storageURL,
                )
        }
        for (i = 0; i < 3; i++) {
          await proofChain.connect(operators[i+3])
                .submitBlockResultProof(
                    chainId,
                    blockHeight,
                    getHash("2"),
                    getHash("2"),
                    storageURL,
                )
        }
        for (i = 0; i < 3; i++) {
          await proofChain.connect(operators[i+6])
                .submitBlockResultProof(
                    chainId,
                    blockHeight,
                    altHash,
                    altHash,
                    storageURL,
                )
        }
        await proofChain.connect(operators[9])
                .submitBlockResultProof(
                    chainId,
                    blockHeight,
                    getHash("1"),
                    getHash("1"),
                    storageURL,
                )

        await mineBlocks(10)

        await expect(proofChain.connect(owner).finalizeAndRewardBlockResultSession( chainId, blockHeight))
        .to.emit(proofChain, 'BRPQuorumNotReached').withArgs(chainId, blockHeight);

        await expect(proofChain
          .connect(delegators[1])
          .arbitrateBlockResultSession(
            chainId,
            blockHeight,
            altHash,
            altHash
        )
          ).to.emit(proofChain, 'BlockResultRewardAwarded')
          .withArgs(chainId, blockHeight, altHash, altHash);


        for (i = 0; i < 5; i++) {
          await proofChain.connect(operators[i])
                .submitBlockResultProof(
                    chainId,
                    1,
                    specimenHash,
                    specimenHash,
                    storageURL,
                )
        }
        for (i = 0; i < 5; i++) {
          await proofChain.connect(operators[i+5])
                .submitBlockResultProof(
                    chainId,
                    1,
                    getHash("2"),
                    getHash("3"),
                    storageURL,
                )
        }

        await mineBlocks(10)

        proofChain.connect(owner).finalizeAndRewardBlockResultSession( chainId, 1)

        await expect(proofChain
          .connect(delegators[1])
          .arbitrateBlockResultSession(
            chainId,
            1,
            getHash("2"),
            getHash("3")
        )
          ).to.emit(proofChain, 'BlockResultRewardAwarded')
          .withArgs(chainId, 1, getHash("2"), getHash("3"));
    });


    it('Should emit BlockResultRewardAwarded with correct args when correct hash was not submitted by anyone', async function() {
      await proofChain.connect(owner).setSessionDuration(10);
      await proofChain.connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  getHash("1"),
                  specimenHash,
                  storageURL,
              )

        await proofChain.connect(operators[3])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  getHash("2"),
                  getHash("2"),
                  storageURL,
              )

      await mineBlocks(10)

      await expect(proofChain.connect(owner).finalizeAndRewardBlockResultSession( chainId, blockHeight))
      .to.emit(proofChain, 'BRPQuorumNotReached').withArgs(chainId, blockHeight);

      await proofChain.connect(owner).addAuditor(delegators[1].address)

      await expect(proofChain
        .connect(delegators[1])
        .arbitrateBlockResultSession(
          chainId,
          blockHeight,
          altHash,
          altHash
      )
        ).to.emit(proofChain, 'BlockResultRewardAwarded')
        .withArgs(chainId, blockHeight, altHash, altHash);
  });

  });
