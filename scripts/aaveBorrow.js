const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("../scripts/getWeth");

async function main() {
  await getWeth();
  const { deployer } = await getNamedAccounts();
  const lendingPool = await getLendingPool(deployer);
  console.log(`LendingPool Address is ${lendingPool.address}`);

  // Deposit
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  await approveERC20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);
  console.log("Depositing...");
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
  console.log("Deposited!");

  // Borrow
  let { availableBorrowsETH, totalDebtETH } = await getUserDataForBorrow(
    lendingPool,
    deployer
  );
  const daiPrice = await getDAIPrice();
  const amountOfDAIToBorrow =
    availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber());
  console.log(`You can borrow ${amountOfDAIToBorrow} DAI`);
  const amountOfDAIToBorrowWei = ethers.utils.parseEther(
    amountOfDAIToBorrow.toString()
  );

  const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  await borrowDAI(
    daiTokenAddress,
    lendingPool,
    amountOfDAIToBorrowWei,
    deployer,
    amountOfDAIToBorrow
  );

  await getUserDataForBorrow(lendingPool, deployer);

  // repay
  await repayDAI(
    daiTokenAddress,
    lendingPool,
    amountOfDAIToBorrowWei,
    deployer,
    amountOfDAIToBorrow
  );

  await getUserDataForBorrow(lendingPool, deployer);
}

async function borrowDAI(
  daiAddress,
  lendingPool,
  amountOfDAIToBorrowWei,
  account,
  amountOfDAIToBorrow
) {
  const borrowTx = await lendingPool.borrow(
    daiAddress,
    amountOfDAIToBorrowWei,
    1,
    0,
    account
  );
  await borrowTx.wait(1);
  console.log(`Borrowed ${amountOfDAIToBorrow} DAI!`);
}

async function repayDAI(
  daiAddress,
  lendingPool,
  amountToRepay,
  account,
  amountBorrowed
) {
  await approveERC20(daiAddress, lendingPool.address, amountToRepay, account);
  const repayTx = await lendingPool.repay(
    daiAddress,
    amountToRepay,
    1,
    account
  );
  await repayTx.wait(1);
  console.log(`Repayed ${amountBorrowed} DAI!`);
}

async function getDAIPrice() {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x773616E4d11A78F511299002da57A0a94577F1f4"
  );
  const price = (await daiEthPriceFeed.latestRoundData())[1];
  console.log(`The DAI/ETH price is ${price.toString()}`);
  return price;
}

async function getUserDataForBorrow(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account);
  console.log(`Having ${totalCollateralETH} worth of ETH deposited.`);
  console.log(`Having ${totalDebtETH} worth of ETH borrowed.`);
  console.log(
    `Having ${availableBorrowsETH} worth of ETH available for borrowing.`
  );
  return { totalDebtETH, availableBorrowsETH };
}

async function getLendingPool(account) {
  const lendingPoolAddressProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  );
  const lendingPoolAddress = await lendingPoolAddressProvider.getLendingPool();
  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    account
  );
  return lendingPool;
}

async function approveERC20(
  erc20Address,
  spenderAddress,
  amountToSpend,
  account
) {
  const erc20Token = await ethers.getContractAt(
    "IERC20",
    erc20Address,
    account
  );
  const tx = await erc20Token.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log("Approved!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
