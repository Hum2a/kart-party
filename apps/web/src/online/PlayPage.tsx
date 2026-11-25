import { useState } from "react";
import { useNavigate } from "react-router";
import { nicknameSchema, roomCodeSchema } from "@kart-party/game";
import { Button, LinkButton, TextField } from "../ui/primitives";
import { saveName, savedName } from "../live/identity";
import { createRoom, roomExists } from "../api/rooms";
import { useMusic } from "../audio/use-music";
import { SoundButton } from "../audio/SoundSettings";
import { QuickPlay } from "./QuickPlay";
import { useOnline } from "../pwa/install";
import { AnimatePresence, motion } from "motion/react";

export function PlayPage() {
  useMusic("menu");
  const navigate = useNavigate();
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState("");
  const [nameError, setNameError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const online = useOnline();

  const checkName = () => {
    const parsed = nicknameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? "Choose a name.");
      return undefined;
    }
    saveName(parsed.data);
    return parsed.data;
  };

  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 pb-16 pt-8">
      <header>
        <div className="mb-4 flex items-center gap-3">
          <LinkButton to="/" variant="secondary" className="min-h-10 px-3 text-base">
            ← Home
          </LinkButton>
          <SoundButton />
        </div>
        <h1 className="wordmark text-4xl sm:text-5xl">Race friends</h1>
        <p className="text-muted">
          Up to eight people, each on their own device. Share the four-letter code.
        </p>
      </header>
      <AnimatePresence initial={false}>
        {online ? null : (
          <motion.p
            key="offline"
            role="status"
            className="panel border-highlight p-4 font-bold"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            You are offline. Racing friends needs a connection, but{" "}
            <a className="underline" href="/practice">
              practice
            </a>{" "}
            and the{" "}
            <a className="underline" href="/school">
              driving school
            </a>{" "}
            still work.
          </motion.p>
        )}
      </AnimatePresence>
      <div className="panel grid gap-5 p-5">
        <TextField
          label="Your name"
          value={name}
          maxLength={16}
          autoComplete="nickname"
          onChange={(event) => {
            setName(event.target.value);
            setNameError("");
          }}
          error={nameError}
        />
        <Button
          disabled={busy !== null}
          onClick={async () => {
            if (!checkName()) return;
            setBusy("create");
            const created = await createRoom();
            setBusy(null);
            if (created.ok) navigate(`/r/${created.code}`);
            else setNameError(created.message);
          }}
        >
          {busy === "create" ? "Creating…" : "Create a room"}
        </Button>
      </div>
      <form
        className="panel grid gap-4 p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!checkName()) return;
          const parsed = roomCodeSchema.safeParse(code);
          if (!parsed.success) {
            setCodeError("A room code is four letters.");
            return;
          }
          setBusy("join");
          const exists = await roomExists(parsed.data);
          setBusy(null);
          if (exists) navigate(`/r/${parsed.data}`);
          else setCodeError("No room has that code. Check it with the host.");
        }}
      >
        <TextField
          label="Room code"
          value={code}
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          className="[&_input]:font-mono [&_input]:text-2xl [&_input]:uppercase [&_input]:tracking-[0.4em]"
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setCodeError("");
          }}
          error={codeError}
        />
        <Button type="submit" variant="secondary" disabled={busy !== null}>
          {busy === "join" ? "Checking…" : "Join room"}
        </Button>
      </form>
      <QuickPlay
        onJoin={(room) => {
          if (checkName()) navigate(`/r/${room}`);
        }}
      />
    </main>
  );
}
