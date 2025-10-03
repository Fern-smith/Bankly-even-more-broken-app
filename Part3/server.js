const app = require("./app");

app
  .listen(3000, () => {
    console.log(`Server starting on port 3000`);
  })
  .on("error", (err) => {
    console.error("Server error:", err);
  });

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});