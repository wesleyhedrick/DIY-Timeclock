import "./styles.css";

export const metadata = {
  title: "Help Time Clock",
  description: "Employee Help Time tracking"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
