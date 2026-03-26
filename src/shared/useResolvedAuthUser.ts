import { useEffect, useState } from "react";

import { getUser, subscribeAuthChanges, syncUserFromApi, type User } from "./auth";

type UseResolvedAuthUserOptions = {
  requireSession?: boolean;
  validateOnMount?: boolean;
};

export function useResolvedAuthUser(options: UseResolvedAuthUserOptions = {}) {
  const requireSession = options.requireSession ?? false;
  const validateOnMount = options.validateOnMount ?? false;
  const [user, setUser] = useState<User | null>(() => getUser());
  const [loading, setLoading] = useState(validateOnMount || requireSession);

  useEffect(() => {
    const shouldResolve = validateOnMount || requireSession;
    if (!shouldResolve) {
      setUser(getUser());
      setLoading(false);
      return subscribeAuthChanges(() => {
        setUser(getUser());
      });
    }

    let cancelled = false;

    async function loadUser() {
      setLoading(true);

      try {
        const nextUser = await syncUserFromApi({ force: shouldResolve });
        if (!cancelled) {
          setUser(nextUser);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    const unsubscribe = subscribeAuthChanges(() => {
      setUser(getUser());
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [requireSession, validateOnMount]);

  return {
    user,
    loading,
    setUser,
  };
}
