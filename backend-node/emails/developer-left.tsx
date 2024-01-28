import { Text } from "@react-email/components";
import { format } from "date-fns";
import { Base } from "./base";

interface DeveloperLeftEmailProps {
  appId?: string;
  appName?: string;
  category: string;
  subject: string;
  provider: string;
  login: string;
  time: string;
  previewText: string;
}

export const DeveloperLeftEmail = ({
  category,
  appId,
  appName,
  subject,
  provider,
  login,
  time,
  previewText,
}: DeveloperLeftEmailProps) => {
  const formattedTime = format(time, "PPPPpppp");

  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text>Someone recently logged into your account on Flathub.</Text>
      <Text className="-mt-4">
        If this was you, there's nothing for you to do right now.
      </Text>
      <Text>
        <b>Time: </b>
        {formattedTime}
      </Text>
      <Text className="-mt-4">
        <b>Account: </b>
        {login}
      </Text>
      <Text className="-mt-4">
        <b>Login provider: </b>
        {provider}
      </Text>
      <Text>
        If it wasn't you, please{" "}
        <a href="mailto:admins@flathub.org">contact us</a> immediately.
      </Text>
    </Base>
  );
};

DeveloperLeftEmail.PreviewProps = {
  subject: "New login on Flathub",
  category: "security_login",
  provider: "github",
  login: "testuser",
  time: "2017-01-01T00:00:00Z",
  previewText: "New login to Flathub account",
} as DeveloperLeftEmailProps;

export default DeveloperLeftEmail;
