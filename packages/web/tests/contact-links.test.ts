import { describe, expect, test } from "bun:test";
import { requestLinks } from "../src/web/lib/site";
import { manualRequestInput, normalizedRequestStatus, requestStatus } from "../src/shared/requests";

describe("Native request links", () => {
  test("encodes every dynamic field, including special characters", () => {
    const title = 'Море & свет "№1"? # + %';
    const dimensions = '30×40 см & рама';
    const contact = 'Имя+mail@example.com & +7 999 123';
    const name = 'Иван & Мария';
    const message = 'Заказ?\nСпасибо #1';
    const links = requestLinks(title, dimensions, contact, name, message);
    const mail = new URL(links.mail);
    const vk = new URL(links.vk);
    expect(mail.protocol).toBe("mailto:");
    expect(mail.pathname).toBe("telnov.aleosch@yandex.ru");
    expect(mail.searchParams.get("subject")).toBe(`Заявка на картину: ${title}`);
    expect([...mail.searchParams.keys()]).toEqual(["subject", "body"]);
    for (const v of [title, dimensions, contact, name, message]) {
      expect(mail.searchParams.get("body")).toContain(v);
      expect(vk.searchParams.get("text")).toContain(v);
    }
    expect(vk.origin + vk.pathname).toBe("https://vk.me/alain_rusin");
    expect([...vk.searchParams.keys()]).toEqual(["text"]);
  });
  test("generic B2B requests do not contain undefined artwork data", () => {
    const links = requestLinks("", "", "example@example.org");
    expect(decodeURIComponent(links.mail)).not.toContain("undefined");
    expect(new URL(links.mail).searchParams.get("body")).toContain("example@example.org");
  });
});
describe("Manual requests", () => {
  test("supports exactly four new statuses and displays historical records", () => {
    for (const v of ["new", "in_progress", "sold", "cancelled"]) expect(requestStatus.parse(v)).toBe(v);
    expect(requestStatus.safeParse("processed").success).toBe(false);
    expect(normalizedRequestStatus("processed")).toBe("in_progress");
  });
  test("validates name, contact and existing-artwork identifier shape", () => {
    const value = { clientName: " Иван ", clientContact: " +7 123 ", artworkId: "00000000-0000-4000-8000-000000000001" };
    expect(manualRequestInput.parse(value)).toMatchObject({ clientName: "Иван", clientContact: "+7 123", status: "new" });
    expect(manualRequestInput.safeParse({ ...value, clientName: " " }).success).toBe(false);
    expect(manualRequestInput.safeParse({ ...value, artworkId: "../../admin" }).success).toBe(false);
  });
});