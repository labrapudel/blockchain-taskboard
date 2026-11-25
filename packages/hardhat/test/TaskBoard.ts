import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

async function fixture() {
  const [owner, other] = await ethers.getSigners();
  const board = await ethers.deployContract("TaskBoard");
  return { board, owner, other };
}

describe("TaskBoard", function () {
  it("adds a task and persists the completed status", async function () {
    const { board, owner } = await networkHelpers.loadFixture(fixture);
    await board.addTask("Review the report");
    expect(await board.taskCount(owner.address)).to.equal(1n);
    expect(Array.from(await board.taskAt(owner.address, 0))).to.deep.equal(["Review the report", false]);
    await board.completeTask(0);
    expect(Array.from(await board.taskAt(owner.address, 0))).to.deep.equal(["Review the report", true]);
  });

  it("emits TaskChanged on both writes", async function () {
    const { board, owner } = await networkHelpers.loadFixture(fixture);
    await expect(board.addTask("Read the instructions")).to.emit(board, "TaskChanged").withArgs(owner.address, 0n, false);
    await expect(board.completeTask(0)).to.emit(board, "TaskChanged").withArgs(owner.address, 0n, true);
  });

  it("rejects empty or oversized titles, unknown tasks and repeated completion", async function () {
    const { board } = await networkHelpers.loadFixture(fixture);
    await expect(board.addTask("")).to.be.revertedWith("Title must be 1-120 bytes");
    await expect(board.addTask("я".repeat(61))).to.be.revertedWith("Title must be 1-120 bytes");
    await expect(board.completeTask(0)).to.be.revertedWith("Task not found");
    await board.addTask("я".repeat(60));
    await board.completeTask(0);
    await expect(board.completeTask(0)).to.be.revertedWith("Task already done");
  });

  it("keeps write access scoped to the signing wallet", async function () {
    const { board, owner, other } = await networkHelpers.loadFixture(fixture);
    await board.addTask("Owner task");
    await expect(board.connect(other).completeTask(0)).to.be.revertedWith("Task not found");
    await board.connect(other).addTask("Other task");
    await board.connect(other).completeTask(0);
    expect((await board.taskAt(owner.address, 0)).done).to.equal(false);
    expect((await board.taskAt(other.address, 0)).done).to.equal(true);
  });
});
