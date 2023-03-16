const {
  setupDefaultOperators,
  oneToken,
  mineBlocks,
  getHash
} = require('../../fixtures.js');
const {expect} = require('chai');
const createKeccakHash = require('keccak');

describe('Block Specimen Arbitration Tests', function() {
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
    specimenHash = getHash('main specimen')
    altHash = getHash('alternate specimen')
    sessionDuration = (await proofChain.connect(owner).getMetadata()).blockSpecimenSessionDuration;
  });

  it('Reverts if non AUDITOR_ROLE to call the function', async function() {
    await expect(
        proofChain
            .connect(delegators[0])
            .arbitrateBlockSpecimenSession(chainId, blockHeight, specimenHash, specimenHash),
    ).to.be.revertedWith('Sender is not AUDITOR_ROLE');
  });



  it('Reverts if the block specimen session has not started', async function() {
    notStartedBlockHeight = 9999999999;
    await proofChain.connect(owner).addAuditor(delegators[1].address)
    await expect(
        proofChain
            .connect(delegators[1])
            .arbitrateBlockSpecimenSession(
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
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                specimenHash,
                specimenHash,
                storageURL,
            ),
    )
        .to.emit(proofChain, 'BlockSpecimenProductionProofSubmitted');
        await proofChain.connect(owner).addAuditor(delegators[1].address)
    await expect(
        proofChain
            .connect(delegators[1])
            .arbitrateBlockSpecimenSession(chainId, blockHeight, specimenHash, specimenHash),
    ).to.be.revertedWith('Session must be finalized before audit');
  });



  it('Reverts when arbitration happens before finalize', async function() {
    newSessionDuration = 20;
    await proofChain
        .connect(owner)
        .setSessionDuration(newSessionDuration);

    await proofChain
            .connect(operators[1])
            .submitBlockSpecimenProof(
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
        .arbitrateBlockSpecimenSession(chainId, blockHeight, specimenHash, specimenHash)
        ).to.be.revertedWith('Session must be finalized before audit');
  });

  it('Allows arbitration after finalize', async function() {
    newSessionDuration = 20;
    await proofChain
        .connect(owner)
        .setSessionDuration(newSessionDuration);

    await proofChain
            .connect(operators[1])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                specimenHash,
                specimenHash,
                storageURL,
            )

    await mineBlocks(newSessionDuration + 1);

    await proofChain.finalizeAndRewardSpecimenSession(chainId, blockHeight)

    await proofChain.connect(owner).addAuditor(delegators[1].address)

    await expect(proofChain
        .connect(delegators[1])
        .arbitrateBlockSpecimenSession(chainId, blockHeight, specimenHash, specimenHash)
        ).to.emit(proofChain, 'BlockSpecimenRewardAwarded')
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
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                specimenHash,
                specimenHash,
                storageURL,
            ),
    )
        .to.emit(proofChain, 'BlockSpecimenProductionProofSubmitted')

    await mineBlocks(newSessionDuration + 1);

    await proofChain.connect(owner).addAuditor(delegators[1].address)

    await proofChain.finalizeAndRewardSpecimenSession(chainId, blockHeight)

    await expect(
        proofChain
            .connect(delegators[1])
            .arbitrateBlockSpecimenSession(chainId, blockHeight, specimenHash, specimenHash),
    ).to.emit(proofChain, 'BlockSpecimenRewardAwarded');
  });



  it('Should emit BlockSpecimenRewardAwarded with correct args when quorum not reached', async function() {
      await proofChain.connect(owner).setSessionDuration(10);
      await proofChain.connect(owner).addAuditor(delegators[1].address)

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

      await expect(proofChain
        .connect(delegators[1])
        .arbitrateBlockSpecimenSession(
          chainId,
          blockHeight,
          altHash,
          altHash
      )
        ).to.emit(proofChain, 'BlockSpecimenRewardAwarded')
        .withArgs(chainId, blockHeight, altHash, altHash);


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
                  getHash("3"),
                  storageURL,
              )
      }

      await mineBlocks(10)

      proofChain.connect(owner).finalizeAndRewardSpecimenSession( chainId, 1)

      await expect(proofChain
        .connect(delegators[1])
        .arbitrateBlockSpecimenSession(
          chainId,
          1,
          getHash("2"),
          getHash("3")
      )
        ).to.emit(proofChain, 'BlockSpecimenRewardAwarded')
        .withArgs(chainId, 1, getHash("2"), getHash("3"));
  });


  it('Should emit BlockSpecimenRewardAwarded with correct args when correct hash was not submitted by anyone', async function() {
    await proofChain.connect(owner).setSessionDuration(10);
    await proofChain.connect(operators[0])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                getHash("1"),
                specimenHash,
                storageURL,
            )

      await proofChain.connect(operators[3])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                getHash("2"),
                getHash("2"),
                storageURL,
            )

    await mineBlocks(10)

    await expect(proofChain.connect(owner).finalizeAndRewardSpecimenSession( chainId, blockHeight))
    .to.emit(proofChain, 'BSPQuorumNotReached').withArgs(chainId, blockHeight);

    await proofChain.connect(owner).addAuditor(delegators[1].address)

    await expect(proofChain
      .connect(delegators[1])
      .arbitrateBlockSpecimenSession(
        chainId,
        blockHeight,
        altHash,
        altHash
    )
      ).to.emit(proofChain, 'BlockSpecimenRewardAwarded')
      .withArgs(chainId, blockHeight, altHash, altHash);
});

});
