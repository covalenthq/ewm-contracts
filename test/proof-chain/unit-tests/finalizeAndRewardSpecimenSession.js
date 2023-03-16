const {
    setupDefaultOperators,
    oneToken,
    mineBlocks,
    getHash
  } = require('../../fixtures.js');
  const {expect} = require('chai');

  describe('Block Specimen Session finalization Tests', function() {
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

      chainId = 1;
      blockHeight = 123;
      specimenSize = 15;
      specimenLength = 1;
      storageURL = 'example.com';
      specimenHash = getHash("main specimen")
      altHash = getHash("alternate specimen")
      sessionDuration = (await proofChain.connect(owner).getMetadata()).blockSpecimenSessionDuration;
    });

    it('Reverts if the block specimen session has not started', async function() {
      await expect(
          proofChain
              .connect(owner)
              .finalizeAndRewardSpecimenSession(
                chainId,
                9999999999
              )
      ).to.be.revertedWith('Session not started');
    });

    it('Reverts if the deadline has not been reached', async function() {
      await expect(
          proofChain
              .connect(operators[0])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              ),
      )
          .to.emit(proofChain, 'BlockSpecimenProductionProofSubmitted');

      await expect(
          proofChain
              .connect(owner)
              .finalizeAndRewardSpecimenSession(
                chainId,
                blockHeight
              )
      ).to.be.revertedWith('Session not past deadline');
    });

    it('Changes require audit to true when not enough participants submitted, emits event and reverts if called again', async function() {
      await proofChain.connect(owner).setSessionDuration(10);

      await proofChain
            .connect(operators[0])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                specimenHash,
                specimenHash,
                storageURL,
            )

      await proofChain
            .connect(operators[1])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                altHash,
                altHash,
                storageURL,
            )

      await mineBlocks(10)

      await expect(proofChain
            .connect(owner)
            .finalizeAndRewardSpecimenSession(
              chainId,
              blockHeight
            )
            ).to.emit(proofChain, 'BSPQuorumNotReached')
            .withArgs(chainId, blockHeight);

      await expect(
          proofChain
              .connect(owner)
              .finalizeAndRewardSpecimenSession(
                chainId,
                blockHeight
              )
      ).to.be.revertedWith('Session cannot be finalized');

    });

    it('Changes require audit to true when quorum was not reached, emits event and reverts if called again', async function() {
      await proofChain.connect(owner).setSessionDuration(10);

      for (i = 0; i < 3; i++) {
        await proofChain.connect(operators[i])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              )
      }
      for (i = 0; i < 3; i++) {
        await proofChain.connect(operators[i+3])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("2"),
                  getHash("2"),
                  storageURL,
              )
      }
      for (i = 0; i < 3; i++) {
        await proofChain.connect(operators[i+6])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  altHash,
                  altHash,
                  storageURL,
              )
      }
      await proofChain.connect(operators[9])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("1"),
                  getHash("1"),
                  storageURL,
              )

      await mineBlocks(10)

      await expect(proofChain.connect(owner).finalizeAndRewardSpecimenSession( chainId, blockHeight))
      .to.emit(proofChain, 'BSPQuorumNotReached').withArgs(chainId, blockHeight);

      await expect(proofChain.connect(owner).finalizeAndRewardSpecimenSession( chainId, blockHeight))
      .to.be.revertedWith('Session cannot be finalized');


      for (i = 0; i < 5; i++) {
        await proofChain.connect(operators[i])
              .submitBlockSpecimenProof(
                  chainId,
                  1,
                  specimenHash,
                  specimenHash,
                  storageURL,
              )
      }
      for (i = 0; i < 5; i++) {
        await proofChain.connect(operators[i+5])
              .submitBlockSpecimenProof(
                  chainId,
                  1,
                  getHash("2"),
                  getHash("2"),
                  storageURL,
              )
      }

      await mineBlocks(10)

      await expect(proofChain.connect(owner).finalizeAndRewardSpecimenSession( chainId, 1))
      .to.emit(proofChain, 'BSPQuorumNotReached').withArgs(chainId, 1);

      await expect(proofChain.connect(owner).finalizeAndRewardSpecimenSession( chainId, 1))
      .to.be.revertedWith('Session cannot be finalized');
    });

    it('Emits specimen hash reward awarded event with the correct args when quorum is achieved', async function() {
      await proofChain.connect(owner).setQuorumThreshold(oneToken.div(2)); // 50%
      await proofChain.connect(owner).setSessionDuration(11);

      for (i = 0; i < 6; i++) {
        await proofChain
              .connect(operators[i])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("2"),
                  specimenHash,
                  storageURL,
              )
      }
      for (i = 0; i < 4; i++) {
        await proofChain
              .connect(operators[i+6])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("2"),
                  getHash("2"),
                  storageURL,
              )
      }

      await mineBlocks(10)

      await expect(proofChain
        .connect(owner)
        .finalizeAndRewardSpecimenSession(
          chainId,
          blockHeight
        )
        ).to.emit(proofChain, 'BlockSpecimenRewardAwarded')
        .withArgs(chainId, blockHeight, getHash("2"), specimenHash);

      await expect(
          proofChain
              .connect(owner)
              .finalizeAndRewardSpecimenSession(
                chainId,
                blockHeight
              )
      ).to.be.revertedWith('Session cannot be finalized');
    });


    it('Emits specimen hash reward awarded event with the correct args when quorum is achieved', async function() {
    await proofChain.connect(owner).setQuorumThreshold(oneToken.div(2)); // 50%
      await proofChain.connect(owner).setSessionDuration(11);

      const stake = oneToken.mul(150)
      const totalStake = stake.mul(10)
      const reward = oneToken.mul(stake).div(totalStake)
      const commissionFee = reward.div(10)
      const rewardAfterComission = reward.sub(commissionFee)

      for (i = 0; i < 6; i++) {
        await proofChain
              .connect(operators[i])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("2"),
                  specimenHash,
                  storageURL,
              )
      }
      for (i = 0; i < 4; i++) {
        await proofChain
              .connect(operators[i+6])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("2"),
                  getHash("2"),
                  storageURL,
              )
      }

      await mineBlocks(10)

      let res = proofChain
      .connect(owner)
      .finalizeAndRewardSpecimenSession(
        chainId,
        blockHeight
      )

      await expect(res
        ).to.emit(proofChain, 'BlockSpecimenRewardAwarded')
        .withArgs(chainId, blockHeight, getHash("2"), specimenHash);

  });


  it('Emits specimen hash reward awarded event with the correct args when quorum is achieved', async function() {
    await proofChain.connect(owner).setQuorumThreshold(oneToken.div(2)); // 50%
      await proofChain.connect(owner).setSessionDuration(11);

      const stake = oneToken.mul(150)
      const totalStake = stake.mul(10)
      const reward = oneToken.mul(stake).div(totalStake)
      const commissionFee = reward.div(10)

      for (i = 0; i < 6; i++) {
        await proofChain
              .connect(operators[i])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("2"),
                  specimenHash,
                  storageURL,
              )
      }
      for (i = 0; i < 2; i++) {
        await proofChain
              .connect(operators[i+6])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("3"),
                  getHash("2"),
                  storageURL,
              )
      }

      for (i = 0; i < 2; i++) {
        await proofChain
              .connect(operators[i+8])
              .submitBlockSpecimenProof(
                  chainId,
                  blockHeight,
                  getHash("3"),
                  getHash("2"),
                  storageURL,
              )
      }

      await mineBlocks(10)

      let res = proofChain
      .connect(owner)
      .finalizeAndRewardSpecimenSession(
        chainId,
        blockHeight
      )

      await expect(res
        ).to.emit(proofChain, 'BlockSpecimenRewardAwarded')
        .withArgs(chainId, blockHeight, getHash("2"), specimenHash);

  });
});