"use client";

import { useChannel } from "ably/react";
import { socketChannels } from "@/lib/subscription/channels";
import { useEffect, useRef, useState } from "react";
import {
  addEntry,
  deleteEntry,
  fetchEntries,
  fetchEntry,
  retractVoteForEntry,
  updateEntry,
  upsertUsername,
  voteForEntry,
} from "./serverActions";
import { useCookies } from "react-cookie";
import { Prisma } from "@prisma/client";
import {
  addAt,
  calculateIndexToRestore,
  removeAt,
  replaceAt,
  truncateText,
} from "@/lib/utils";
import { Message } from "ably";
import { useDebouncedCallback } from "use-debounce";
import {
  Button,
  Card,
  IconButton,
  LinearProgress,
  TextField,
  Icon,
} from "actify";
import { useAutosize } from "@/lib/utils/hooks";
import { Toaster, toast } from "sonner";

const getEmptyEntry = (username: string) => ({
  id: "",
  text: "",
  voters: [],
  voterIds: [],
  createdById: "",
  createdBy: { id: "", username, voteEntryIds: [] },
  createdAt: new Date(),
  updatedById: "",
  updatedBy: { id: "", username, voteEntryIds: [] },
  updatedAt: new Date(),
});

type Entry = Prisma.EntryGetPayload<{
  include: { createdBy: true; updatedBy: true; voters: true };
}>;

export default function Home() {
  useAutosize();

  const [loading, setLoading] = useState<null | string>(null);
  const autoLoading = async (callback: () => Promise<void>) => {
    const id = Math.random().toString();
    setLoading(id);
    return callback().finally(() => {
      setLoading((loading) => (loading === id ? null : loading));
    });
  };

  const usernameTag = "username";
  const [cookies, setCookie] = useCookies([usernameTag]);
  const cookieUsername = (cookies.username as string | undefined) ?? "";

  const [username, setUsername] = useState(cookieUsername);
  const [usernameErrorMessage, setUsernameErrorMessage] = useState<
    string | undefined
  >();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [deletedEntries, setDeletedEntries] = useState<
    { entry: Entry; originalIndex: number }[]
  >([]);

  // Use ref as a storage for the latest value of entries and deleted entries to
  // avoid it being captured in an old state in a callback function
  const entriesRef = useRef<Entry[]>([]);
  entriesRef.current = entries;
  const deletedEntriesRef = useRef<{ entry: Entry; originalIndex: number }[]>(
    []
  );
  deletedEntriesRef.current = deletedEntries;

  const setEntry = (entry: Entry | null, id: string, restore = false) => {
    const index = entriesRef.current.findIndex(
      (e) => e.id === id || e.id === ""
    );
    if (index >= 0) {
      if (entry) {
        setEntries((entries) => replaceAt(entries, index, entry));
      } else {
        const entry = entriesRef.current[index];
        setEntries((entries) => removeAt(entries, index));
        setDeletedEntries((deletedEntries) =>
          deletedEntries.concat({ entry, originalIndex: index })
        );
      }
    } else if (entry) {
      setEntries((entries) => [...entries, entry]);
    } else if (restore) {
      const deletedEntryIndex = deletedEntriesRef.current.findIndex(
        (deletedEntry) => deletedEntry.entry.id === id
      );
      if (deletedEntryIndex < 0) return;

      const deletedEntry = deletedEntriesRef.current[deletedEntryIndex];

      const newDeletedEntries = removeAt(
        deletedEntriesRef.current,
        deletedEntryIndex
      );
      const newIndex = calculateIndexToRestore(
        deletedEntry.originalIndex,
        newDeletedEntries.map((e) => e.originalIndex)
      );

      setEntries((entries) => addAt(entries, newIndex, deletedEntry.entry));
      setDeletedEntries(newDeletedEntries);
    }
  };

  const getEntries = async () => {
    setEntries(await fetchEntries());
  };
  const getEntry = async (id: string) => {
    setEntry(await fetchEntry(id), id);
  };

  useEffect(() => {
    autoLoading(getEntries);

    const abortController = new AbortController();

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "visible") {
          autoLoading(getEntries);
        }
      },
      { signal: abortController.signal }
    );

    return () => {
      abortController.abort();
    };
  }, []);

  const onUpdateMessage = async (message: Message) => {
    autoLoading(async () => {
      const id = message.data;
      if (typeof id !== "string") return;
      await getEntry(id);
    });
  };

  useChannel(
    socketChannels.voting.name,
    socketChannels.voting.events.update,
    onUpdateMessage
  );

  const handleUsernameChangeDebounced = useDebouncedCallback(
    async (username: string) => {
      if (!username || username == cookieUsername) {
        setUsernameErrorMessage(undefined);
        return;
      }

      autoLoading(async () => {
        const result = await upsertUsername(username, cookieUsername);
        if (result.success && usernameErrorMessage !== undefined) {
          setUsernameErrorMessage(undefined);
        } else if (!result.success) {
          setUsernameErrorMessage(result.error);
          return;
        }

        await getEntries();
        setCookie(usernameTag, username);
      });
    },
    2000
  );

  const onUsernameValueChange = async (value: string) => {
    setUsername(value);

    await handleUsernameChangeDebounced(value);
  };

  const handleUpdateEntry = async (id: string, value: string) => {
    autoLoading(async () => {
      await updateEntry(id, value, cookieUsername);
    });
  };

  const handleUpdateEntryDebounced = useDebouncedCallback(
    handleUpdateEntry,
    3000
  );

  const onEntryChange = (entry: Entry, text: string) => {
    setEntry(
      {
        ...entry,
        text,
      },
      entry.id
    );
    handleUpdateEntryDebounced(entry.id, text);
  };

  const onEntryFocusChanged = (focused: boolean) => {
    if (!focused) {
      handleUpdateEntryDebounced.flush();
    }
  };

  const handleDeleteEntry = async (entry: Entry) => {
    const toastMessageSuffix = entry.text && `: ${truncateText(entry.text)}`;
    const toastMessage = `Удалено${toastMessageSuffix || " пустую запись"}`;

    setEntry(null, entry.id);
    toast(toastMessage, {
      action: {
        label: "Отменить",
        onClick: async () => {
          setEntry(null, entry.id, true);
        },
      },
      onAutoClose: async () => {
        autoLoading(async () => {
          await deleteEntry(entry.id);
        });
      },
    });
  };
  const handleAddEntry = async () => {
    autoLoading(async () => {
      setEntry(getEmptyEntry(username), "");
      await addEntry("", cookieUsername);
    });
  };
  const handleToggleVote = async (
    id: string,
    entry: Entry,
    hasVotedForEntry: boolean
  ) => {
    autoLoading(async () => {
      if (hasVotedForEntry) {
        setEntry(
          {
            ...entry,
            voters: entry.voters.filter((voter) => voter.username !== username),
          },
          id
        );
        await retractVoteForEntry(id, cookieUsername);
      } else {
        setEntry(
          {
            ...entry,
            voters: entry.voters.concat({
              id: "",
              username,
              voteEntryIds: [entry.id],
            }),
          },
          id
        );
        await voteForEntry(id, cookieUsername);
      }
    });
  };

  return (
    <div className="flex items-center justify-center">
      <main className="max-w-[500px] w-full flex flex-col gap-5 p-5">
        <LinearProgress
          indeterminate
          className={loading ? "visible" : "invisible"}
        />

        <TextField
          label="Имя"
          type="text"
          name="name"
          value={username}
          onChange={onUsernameValueChange}
          variant="outlined"
          isDisabled={!!loading}
          description={usernameErrorMessage}
        />

        <div
          className={`flex flex-col gap-3 ${
            username ? "visible" : "invisible"
          }`}
        >
          {entries.map((entry) => {
            const hasVotedForEntry = entry.voters.some(
              (voter) => voter.username === username
            );
            return (
              <Card variant="filled" className="grow" key={entry.id}>
                <div className="p-3 flex flex-col gap-2">
                  <div className="grow rounded-t-lg overflow-hidden">
                    <TextField
                      label="Предложение"
                      type="textarea"
                      value={entry.text}
                      onChange={(value: string) => {
                        onEntryChange(entry, value);
                      }}
                      onFocusChange={onEntryFocusChanged}
                      variant="filled"
                      isDisabled={!!loading}
                    />
                  </div>
                  <div className="flex justify-between">
                    <div>
                      <p>Автор: {entry.createdBy.username}</p>
                      {entry.updatedBy &&
                        entry.updatedBy.id !== entry.createdBy.id && (
                          <p>
                            Изменил(а): {entry.updatedBy?.username}
                            {/* {" "}(
                            {moment(entry.updatedAt).format("HH:mm DD.MM.YY")}) */}
                          </p>
                        )}
                      <p>За: {entry.voters.length}</p>
                    </div>
                    <div className="flex gap-1">
                      <IconButton
                        onPress={() =>
                          handleToggleVote(entry.id, entry, hasVotedForEntry)
                        }
                        isDisabled={!!loading}
                      >
                        <Icon style={{ fill: "1" }} fill={hasVotedForEntry}>
                          favorite
                        </Icon>
                      </IconButton>
                      <IconButton
                        onPress={() => handleDeleteEntry(entry)}
                        isDisabled={!!loading}
                      >
                        <Icon>delete</Icon>
                      </IconButton>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          <Button
            onPress={handleAddEntry}
            variant="outlined"
            className="w-full"
            isDisabled={!!loading}
          >
            <Icon>add</Icon>
          </Button>
        </div>
      </main>
      <Toaster />
    </div>
  );
}

// TODO: restore focus after loading
