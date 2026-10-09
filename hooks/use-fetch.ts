import { useCallback, useState } from "react";
import { toast } from "sonner";

type FetchState<T> = {
  data: T | undefined;
  loading: boolean | null;
  error: Error | null;
};

function useFetch<Args extends unknown[], R>(
  cb: (...args: Args) => Promise<R>
) {
  const [data, setData] = useState<R | undefined>(undefined);
  const [loading, setLoading] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fn = useCallback(
    async (...args: Args): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await cb(...args);
        setData(response);
        setError(null);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    },
    [cb]
  );

  return { data, loading, error, fn, setData };
}

export default useFetch;
