if (process.env.ALLOW_FULL_TESTS !== "1") {
  console.error(
    "Full test suite is disabled locally. Use GitHub Actions CI."
  );
  process.exit(1);
}