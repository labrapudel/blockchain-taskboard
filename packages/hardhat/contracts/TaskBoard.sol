// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TaskBoard {
    struct Task {
        string title;
        bool done;
    }

    mapping(address => Task[]) private tasks;
    event TaskChanged(address indexed owner, uint256 indexed taskId, bool done);

    function taskCount(address owner) external view returns (uint256) {
        return tasks[owner].length;
    }

    function taskAt(address owner, uint256 taskId) external view returns (Task memory) {
        require(taskId < tasks[owner].length, "Task not found");
        return tasks[owner][taskId];
    }

    function addTask(string calldata title) external {
        bytes calldata content = bytes(title);
        require(content.length > 0 && content.length <= 120, "Title must be 1-120 bytes");
        tasks[msg.sender].push(Task(title, false));
        emit TaskChanged(msg.sender, tasks[msg.sender].length - 1, false);
    }

    function completeTask(uint256 taskId) external {
        require(taskId < tasks[msg.sender].length, "Task not found");
        Task storage task = tasks[msg.sender][taskId];
        require(!task.done, "Task already done");
        task.done = true;
        emit TaskChanged(msg.sender, taskId, true);
    }
}
