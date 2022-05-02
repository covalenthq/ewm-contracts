const {expect} = require('chai');
const {
  getAll,
  impersonateAll,
  oneToken,
  OWNER,
  VALIDATOR_1,
  VALIDATOR_2,
  OPERATOR_1,
  CQT_ETH_MAINNET,
  getOwner,
  OPERATOR_2,
  DELEGATOR_1,
  DELEGATOR_2,
  CQT,
  deposit,
  stake,
  addEnabledValidator,
} = require('../../fixtures');

describe('Get metadata', function() {
  it('Should return correct number of validators.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    // deposit(contract, oneToken.mul(100000))
    let validatorsN = (await contract.getMetadata())._validatorsN;
    expect(validatorsN).to.equal(0);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    validatorsN = (await contract.getMetadata())._validatorsN;
    expect(validatorsN).to.equal(1);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_2, 20);
    await addEnabledValidator(0, contract, opManager, DELEGATOR_2, 20);
    validatorsN = (await contract.getMetadata())._validatorsN;

    expect(validatorsN).to.equal(3);
  });

  it('Should return correct CQT address.', async function() {
    await impersonateAll();
    const owner = await getOwner();

    const staking = await ethers.getContractFactory(
        'OperationalStaking',
        owner,
    );
    const contract = await upgrades.deployProxy(
        staking,
        [CQT_ETH_MAINNET, 1, 1, 1, 1], // delegatorCoolDown, validatorCoolDown, maxCapMultiplier, vMaxStakeCap],
        {initializer: 'initialize'},
    );
    const stakingContract = await contract.deployed();
    const md = await stakingContract.getMetadata();

    expect(md.CQTaddress).to.equal(CQT_ETH_MAINNET);
  });

  it('Should return correct staking manager address.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.setStakingManagerAddress(delegator1.address);
    const md = await contract.getMetadata();

    expect(md._stakingManager).to.equal(delegator1.address);
  });

  it('Should return correct reward pool.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    let md = await contract.getMetadata();
    expect(md._rewardPool).to.equal(0);
    await deposit(contract, oneToken.mul(50));
    md = await contract.getMetadata();

    expect(md._rewardPool).to.equal(oneToken.mul(50));
  });

  it('Should return correct delegator cool down .', async function() {
    await impersonateAll();
    const owner = await getOwner();
    const staking = await ethers.getContractFactory(
        'OperationalStaking',
        owner,
    );
    const contract = await upgrades.deployProxy(
        staking,
        [CQT_ETH_MAINNET, 789, 1, 1, 1], // delegatorCoolDown, validatorCoolDown, maxCapMultiplier, vMaxStakeCap],
        {initializer: 'initialize'},
    );
    const stakingContract = await contract.deployed();
    const md = await stakingContract.getMetadata();

    expect(md._delegatorCoolDown).to.equal(789);
  });

  it('Should return correct validator cool down .', async function() {
    await impersonateAll();
    const owner = await getOwner();
    const staking = await ethers.getContractFactory(
        'OperationalStaking',
        owner,
    );
    const contract = await upgrades.deployProxy(
        staking,
        [CQT_ETH_MAINNET, 1, 555, 1, 1], // delegatorCoolDown, validatorCoolDown, maxCapMultiplier, vMaxStakeCap],
        {initializer: 'initialize'},
    );
    const stakingContract = await contract.deployed();
    const md = await stakingContract.getMetadata();

    expect(md._validatorCoolDown).to.equal(555);
  });

  it('Should return correct max cap multiplier.', async function() {
    await impersonateAll();
    const owner = await getOwner();
    const staking = await ethers.getContractFactory(
        'OperationalStaking',
        owner,
    );
    const contract = await upgrades.deployProxy(
        staking,
        [CQT_ETH_MAINNET, 1, 1, 43, 1], // delegatorCoolDown, validatorCoolDown, maxCapMultiplier, vMaxStakeCap],
        {initializer: 'initialize'},
    );
    const stakingContract = await contract.deployed();
    const md = await stakingContract.getMetadata();

    expect(md._maxCapMultiplier).to.equal(43);
  });

  it('Should return correct validator max stake.', async function() {
    await impersonateAll();
    const owner = await getOwner();
    const staking = await ethers.getContractFactory(
        'OperationalStaking',
        owner,
    );
    const contract = await upgrades.deployProxy(
        staking,
        [CQT_ETH_MAINNET, 1, 1, 1, 987], // delegatorCoolDown, validatorCoolDown, maxCapMultiplier, vMaxStakeCap],
        {initializer: 'initialize'},
    );
    const stakingContract = await contract.deployed();
    const md = await stakingContract.getMetadata();

    expect(md._validatorMaxStake).to.equal(987);
  });
});
