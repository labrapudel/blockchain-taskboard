"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

type Status = { kind: "pending" | "success" | "error"; message: string };
const PAGE_SIZE = 10n;

function TaskRow({ owner, id, onComplete, busy }: {
  owner: Address; id: bigint; onComplete?: (id: bigint) => void; busy: boolean;
}) {
  const { data: task } = useScaffoldReadContract({
    contractName: "TaskBoard", functionName: "taskAt", args: [owner, id],
  });

  if (!task) return <li className="border-t border-slate-700 py-4 text-slate-400">Загрузка задачи…</li>;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 py-4">
      <div className="min-w-0">
        <span className="text-xs text-slate-400">Задача № {(id + 1n).toString()}</span>
        <p className="break-all text-lg font-medium">{task.title}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={task.done ? "text-emerald-300" : "text-amber-200"}>{task.done ? "Выполнена" : "Открыта"}</span>
        {onComplete && !task.done && (
          <button type="button" disabled={busy} onClick={() => onComplete(id)}
            className="rounded-md border border-cyan-300 p-2 text-cyan-200 disabled:opacity-50">
            Отметить выполненной
          </button>
        )}
      </div>
    </li>
  );
}

export default function TaskPanel({ mode }: { mode: "read" | "write" }) {
  const { address, isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [page, setPage] = useState(0n);
  const [status, setStatus] = useState<Status>();
  const [resetKey, setResetKey] = useState(0);
  const writable = mode === "write";
  const byteLength = new TextEncoder().encode(title.trim()).length;
  const { data: count, refetch } = useScaffoldReadContract({
    contractName: "TaskBoard", functionName: "taskCount", args: [address],
  });
  const writer = useScaffoldWriteContract({ contractName: "TaskBoard" });
  const total = count ?? 0n;
  const lastPage = total ? (total - 1n) / PAGE_SIZE : 0n;
  const visiblePage = page < lastPage ? page : lastPage;
  const first = visiblePage * PAGE_SIZE;
  const ids = Array.from({ length: Number(total - first < PAGE_SIZE ? total - first : PAGE_SIZE) }, (_, i) => first + BigInt(i));
  const pending = status?.kind === "pending";

  async function transact(operation: () => Promise<unknown>, success: string, onSuccess?: () => void) {
    setStatus({ kind: "pending", message: "Подтвердите транзакцию в кошельке и дождитесь её включения в блок." });
    try {
      const hash = await operation();
      if (!hash) throw new Error("Транзакция не подтверждена. Проверьте подключение к локальной сети.");
      onSuccess?.();
      setStatus({ kind: "success", message: success });
      await refetch();
      setResetKey(value => value + 1);
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message.split("\n")[0] : "Транзакция не выполнена." });
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isConnected || pending || byteLength === 0 || byteLength > 120) return;
    void transact(
      () => writer.writeContractAsync({ functionName: "addTask", args: [title.trim()] }),
      "Задача добавлена.",
      () => setTitle(""),
    );
  }

  function complete(id: bigint) {
    if (!isConnected || pending) return;
    void transact(() => writer.writeContractAsync({ functionName: "completeTask", args: [id] }), "Задача отмечена выполненной.");
  }

  return (
    <main className="mx-auto my-8 w-[min(94%,56rem)] rounded-2xl bg-slate-900 p-5 text-slate-100 sm:p-9">
      <h1 className="text-3xl font-semibold">{writable ? "Управление задачами" : "Мои задачи"}</h1>
      <nav className="my-5 flex flex-wrap gap-4" aria-label="Разделы проекта">
        <Link className="text-cyan-200 underline" href="/tasks" aria-current={writable ? undefined : "page"}>Список задач</Link>
        <Link className="text-cyan-200 underline" href="/tasks/manage" aria-current={writable ? "page" : undefined}>Управление</Link>
      </nav>
      <p className="break-all text-sm text-slate-300">{address ? `Кошелёк: ${address}` : "Подключите MetaMask через меню кошелька вверху."}</p>
      {writable && (
        <form className="my-6 rounded-lg bg-slate-800 p-4" onSubmit={add}>
          <label htmlFor="task-title" className="block text-sm">Название задачи</label>
          <input id="task-title" value={title} onChange={event => setTitle(event.target.value)}
            className="my-2 block w-full rounded-md bg-slate-950 p-3" placeholder="Например, проверить отчёт" />
          <p className="mb-3 text-xs text-slate-300">{byteLength} / 120 байт. Название будет общедоступно в блокчейне.</p>
          <button disabled={!isConnected || pending || byteLength === 0 || byteLength > 120}
            className="rounded-md bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">
            Добавить задачу
          </button>
        </form>
      )}
      {status && <p role={status.kind === "error" ? "alert" : "status"} className="my-4 break-words text-cyan-200">{status.message}</p>}
      {address && (
        <section className="mt-6" aria-label="Задачи подключённого аккаунта">
          <h2 className="text-lg font-medium">Всего задач: {total.toString()}</h2>
          {count === undefined ? <p>Читаю данные из контракта…</p> : total === 0n ? <p>Задач пока нет.</p> : (
            <ul key={resetKey} className="mt-3">
              {ids.map(id => <TaskRow key={id.toString()} owner={address} id={id} onComplete={writable ? complete : undefined} busy={pending} />)}
            </ul>
          )}
          {lastPage > 0n && (
            <div className="mt-4 flex items-center gap-4">
              <button disabled={visiblePage === 0n} onClick={() => setPage(visiblePage - 1n)}>Назад</button>
              <span>{(visiblePage + 1n).toString()} / {(lastPage + 1n).toString()}</span>
              <button disabled={visiblePage === lastPage} onClick={() => setPage(visiblePage + 1n)}>Дальше</button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
