import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import * as React from "react";

const isProduction = process.env.NODE_ENV === "production";

export function buildAppName(appId?: string, appName?: string) {
  if (!appId && !appName) {
    return undefined;
  }

  return appName ? `${appName} (${appId})` : appId;
}

export const Base = ({
  children,
  subject,
  category,
  appId,
  appName,
  previewText,
}: {
  children: React.ReactNode;
  subject: string;
  category: string;
  appId?: string;
  appName?: string;
  previewText: string;
}) => {
  const appNameAndId = buildAppName(appId, appName);

  let emailReason =
    "You are receiving this email because you have an account on Flathub.";

  if (category === "developer_invite" && appNameAndId) {
    emailReason = `You are receiving this email because someone has invited you to become a developer of the app ${appNameAndId} on Flathub.`;
  } else if (appId) {
    emailReason = `You are receiving this email because you are a maintainer of the app ${appNameAndId} on Flathub.`;
  }

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                "flathub-celestial-blue": "rgb(74,144,217)",
              },
            },
          },
        }}
      >
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded-xl my-[40px] mx-auto p-[20px] max-w-[465px]">
            {!isProduction && (
              <Section className="p-4 outline outline-flathub-celestial-blue rounded-xl">
                This email was sent from a development instance.
              </Section>
            )}
            <Section className="mt-[32px]">
              <Img
                src={`https://flathub.org/img/logo/logo-horizontal-email.png`}
                alt="Flathub"
                className="my-0 mx-auto mb-4"
              />
            </Section>
            <Hr></Hr>
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              {subject}
            </Heading>
            {children}
            <Hr />

            <Text className="text-black text-[14px] leading-[24px]">
              {emailReason}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
