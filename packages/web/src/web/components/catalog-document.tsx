import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { pagesImageUrl } from "../../shared/images";
import { contacts, award, money } from "../../shared/gallery";
import { catalogOrder, visibleSeries, type SeriesData } from "../../shared/series";
import type { Artwork } from "./gallery-ui";

const origin = () => window.location.origin;
Font.register({ family: "Cormorant", src: origin() + "/fonts/CormorantGaramond-Regular.ttf" });
Font.register({ family: "Manrope", src: origin() + "/fonts/Manrope-Regular.ttf" });
const style = StyleSheet.create({
  page: {
    backgroundColor: "#F7F5F0",
    color: "#2C2C2C",
    padding: 45,
    fontFamily: "Manrope",
    fontSize: 10,
  },
  logo: { width: 220, alignSelf: "center", marginTop: 65 },
  title: {
    fontFamily: "Cormorant",
    fontSize: 55,
    textAlign: "center",
    marginTop: 85,
    marginBottom: 18,
  },
  small: { fontSize: 9, color: "#77736C", lineHeight: 1.7 },
  line: { borderBottomWidth: 0.5, borderBottomColor: "#B8996F", marginVertical: 20 },
  series: { fontSize: 11, letterSpacing: 2, color: "#8E744F", marginBottom: 15 },
  image: { width: "100%", height: 400, objectFit: "contain", marginBottom: 25 },
  artworkTitle: { fontFamily: "Cormorant", fontSize: 31, marginBottom: 15 },
  row: { flexDirection: "row", marginBottom: 6 },
  label: { width: 100, color: "#77736C" },
  value: { flex: 1, lineHeight: 1.5 },
  price: { fontSize: 15, marginTop: 15 },
  footer: {
    position: "absolute",
    bottom: 25,
    left: 45,
    right: 45,
    color: "#77736C",
    fontSize: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
export async function createCatalog(works: Artwork[], profile: { email: string; city: string }, rows: SeriesData[]) {
  const series = visibleSeries(rows);
  const qr = await QRCode.toDataURL(origin(), {
    type: "image/jpeg",
    margin: 1,
    width: 250,
    color: { dark: "#2C2C2C", light: "#F7F5F0" },
  });
  const ordered = catalogOrder(works, series);
  const doc = (
    <Document title="Каталог работ — Alain Rusin" author="Алексей Русин">
      <Page size="A4" style={style.page}>
        <Image src={pagesImageUrl("/images/logo.jpg")} style={style.logo} />
        <Text style={style.title}>Каталог работ</Text>
        <Text style={{ textAlign: "center", fontSize: 15 }}>{new Date().getFullYear()}</Text>
        <View style={style.line} />
        <Text style={{ ...style.small, textAlign: "center", marginTop: 15 }}>{award}</Text>
        <Text style={{ ...style.small, textAlign: "center", marginTop: 20 }}>{profile.city}</Text>
      </Page>
      {ordered.map((a, i) => (
        <Page key={a.id} size="A4" style={style.page}>
          <Text style={style.series}>{series.find((s) => s.slug === a.series)?.title}</Text>
          <Image
            src={pagesImageUrl(a.imageUrl)}
            style={style.image}
          />
          <Text style={style.artworkTitle}>{a.title}</Text>
          {[
            ["Год", String(a.year)],
            ["Техника", a.technique],
            ["Размеры", a.dimensions],
            ["Оформление", a.framing],
          ].map(([key, value]) => (
            <View key={key} style={style.row}>
              <Text style={style.label}>{key}</Text>
              <Text style={style.value}>{value}</Text>
            </View>
          ))}
          <Text style={style.price}>{money(a.price)}</Text>
          <View style={style.footer}>
            <Text>ALAIN RUSIN</Text>
            <Text>{i + 2}</Text>
          </View>
        </Page>
      ))}
      <Page size="A4" style={style.page}>
        <Image src={pagesImageUrl("/images/logo.jpg")} style={style.logo} />
        <Text style={style.title}>Контакты</Text>
        <Text style={{ textAlign: "center", marginBottom: 25 }}>{profile.city}</Text>
        {contacts.map((c) => (
          <Text key={c.label} style={{ textAlign: "center", marginBottom: 12 }}>
            {c.label} · {c.detail}
          </Text>
        ))}
        {profile.email && (
          <Text style={{ textAlign: "center", marginBottom: 12 }}>{profile.email}</Text>
        )}
        <Image src={qr} style={{ width: 110, height: 110, alignSelf: "center", marginTop: 35 }} />
        <Text style={{ ...style.small, textAlign: "center", marginTop: 15 }}>{origin()}</Text>
      </Page>
    </Document>
  );
  return pdf(doc).toBlob();
}
