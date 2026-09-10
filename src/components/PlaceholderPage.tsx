import Container from "react-bootstrap/Container";

export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Container className="py-3">
      <h1 className="h3">{title}</h1>
      <p className="text-muted">{description}</p>
    </Container>
  );
}
