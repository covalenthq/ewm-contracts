
const {expect} = require('chai');
const { ethers } = require('hardhat');
const {
  impersonateAll,
  getOwner
} = require('../../fixtures');

describe('Initialize contract', function() {
  it('works before and after upgrading', async function() {
    await impersonateAll();
    const owner = await getOwner();
    const pc = await ethers.getContractFactory( 'ProofChain', owner);
    const contract = await upgrades.deployProxy(
        pc,
        [owner.address, "0xFC32F8776b914127159364358eDebC6b504BF221"],
        {initializer: 'initialize'},
    );
    const sss = await contract.deployed();

    await sss.addBSPOperator("0x004cEBf70ef85C93e1F742BA3A7Aa00076138855", 3)
    await sss.getBSPRoleData()
    await expect(await sss.owner()).to.equal(owner.address);

    const SSS2 = await ethers.getContractFactory('ProofChain', owner);
    sss2 = await upgrades.upgradeProxy(sss.address, SSS2,);
    console.log('ProofChain upgraded to:', sss2.address);

    await expect(await sss2.owner()).to.equal(owner.address);

    }
  )



});
