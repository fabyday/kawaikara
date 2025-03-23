const { execSync } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("node:fs")



if (os.platform() === "darwin") { // Mac 전용
    const binPath = path.join(__dirname, "..", "thirdparty", "bin", "darwin");

    try {
        if (fs.existsSync(binPath)) {
            execSync(`chmod -R a+rx "${binPath}"`);
            console.log(`✅ auth succ: ${binPath}`);
        } else {
            console.warn(`⚠️ directory Not Exists: ${binPath}`);
        }
    } catch (error) {
        console.error("❌ auth failed:", error);
        process.exit(1);
    }
} else {
    console.log("ℹ️ it's not darwin");
}