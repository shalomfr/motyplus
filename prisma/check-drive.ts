import { google } from "googleapis";

function getDrive() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oauth2 });
}

async function main() {
  const drive = getDrive();
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;

  console.log("Root folder ID:", rootId);

  // Step 1: Find "updates" under root
  const updatesRes = await drive.files.list({
    q: `name='updates' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  console.log("\n'updates' folders under root:", updatesRes.data.files);

  if (!updatesRes.data.files?.length) { console.log("NO updates folder found!"); return; }
  const updatesId = updatesRes.data.files[0].id!;

  // Step 2: Find "beats" under updates
  const beatsRes = await drive.files.list({
    q: `name='beats' and '${updatesId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  console.log("'beats' folders under updates:", beatsRes.data.files);

  if (!beatsRes.data.files?.length) { console.log("NO beats folder found!"); return; }
  const beatsId = beatsRes.data.files[0].id!;

  // Step 3: List all version folders under beats
  const versionsRes = await drive.files.list({
    q: `'${beatsId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  console.log("\nVersion folders under beats:", versionsRes.data.files?.map(f => f.name));

  // Step 4: For V5 specifically, list setType folders
  const v5Folders = versionsRes.data.files?.filter(f => f.name === "V5");
  console.log(`\nV5 folders found: ${v5Folders?.length}`);

  if (v5Folders?.length) {
    for (const v5 of v5Folders) {
      const setsRes = await drive.files.list({
        q: `'${v5.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
        spaces: "drive",
      });
      console.log(`  V5 (${v5.id}):`, setsRes.data.files?.map(f => f.name));

      // Check first setType for organ folders
      if (setsRes.data.files?.length) {
        const firstSet = setsRes.data.files[0];
        const organsRes = await drive.files.list({
          q: `'${firstSet.id}' in parents and trashed=false`,
          fields: "files(id, name, mimeType)",
          spaces: "drive",
        });
        console.log(`    ${firstSet.name} contents:`, organsRes.data.files?.map(f => `${f.name} (${f.mimeType?.includes('folder') ? 'folder' : 'file'})`));
      }
    }
  }
}

main().catch(console.error);
