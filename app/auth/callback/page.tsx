useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.push("/login");
        return;
      }

      router.push("/dashboard");
    };

    handleAuth();
  }, [router]);

  return <div>Signing you in...</div>;
}