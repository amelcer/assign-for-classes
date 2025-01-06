import { sleep } from "bun";
import { chromium, type Locator, type Page } from "playwright";

const { EMAIL, PASSWORD, LOGIN_URL } = Bun.env;
const CLASS_TO_ASSIGN = Bun.argv[2];

if (!EMAIL || !PASSWORD || !LOGIN_URL || !CLASS_TO_ASSIGN) {
  if (!LOGIN_URL) {
    console.error(`LOGIN_URL is missing in env`);
  }

  if (!EMAIL) {
    console.error(`EMAIL is missing in env`);
  }

  if (!PASSWORD) {
    console.error(`PASSWORD is missing in env`);
  }

  if (!CLASS_TO_ASSIGN) {
    console.error(`CLASS_TO_ASSIGN is missing in script arguments`);
  }

  process.exit(1);
}

assignForClasses(CLASS_TO_ASSIGN);

async function assignForClasses(className: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page, { email: EMAIL!, password: PASSWORD! });
  const { freeClasses, bookedClasses } = await getFreeClasses(page, className);

  if (freeClasses.length === 0 && bookedClasses.length === 0) {
    console.log(`NO CLASSES FOR ${className}`);
    process.exit(0);
  }

  if (freeClasses.length === 0) {
    console.log(`NO FREE CLASSES FOR ${className}`);
    console.log("REGISTERING FOR RESERVE LIST");

    await makeReservation(page, bookedClasses, {
      buttonName: /lista rezerwowa/i,
    });

    console.log(
      `ASSIGNED FOR RESERVE LIST FOR ${bookedClasses.length} classes`
    );
  } else {
    console.log(`ASSIGNING FOR ${className}`);

    await makeReservation(page, freeClasses);

    console.log(`MADE RESERVATIONS FOR ${freeClasses.length} classes`);
  }

  await browser.close();
}

async function login(
  page: Page,
  { email, password }: { email: string; password: string }
) {
  await page.goto(LOGIN_URL!);

  await page.waitForSelector('input[name="userNameOrEmailAddress"]');

  await page.getByLabel(/e-mail/i).fill(email);
  await page.getByLabel(/hasło/i).fill(password);

  await page.getByRole("button", { name: /zaloguj/i }).click();

  await page.waitForSelector(".class-container");
}

async function getFreeClasses(
  page: Page,
  className: string
): Promise<{ freeClasses: Locator[]; bookedClasses: Locator[] }> {
  const classes = await page
    .locator(`.class-container:has-text("${className}")`)
    .all();

  let freeClasses: Locator[] = [];
  let bookedClasses: Locator[] = [];

  for (const classElement of classes) {
    const text = (await classElement.innerText()).toLowerCase();

    if (text.includes("rezerwuj")) {
      freeClasses.push(classElement);
    }

    if (text.includes("lista rezerwowa")) {
      bookedClasses.push(classElement);
    }
  }

  return { freeClasses, bookedClasses };
}

async function makeReservation(
  page: Page,
  classes: Locator[],
  { buttonName }: { buttonName: RegExp } = { buttonName: /rezerwuj/i }
) {
  for (const classElement of classes) {
    await classElement.getByRole("button", { name: buttonName }).click();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: buttonName })
      .click();

    await sleep(1_000);
  }
}
