import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { acceptPublisherAgreement } from "src/asyncs/login"
import Button from "src/components/Button"
import LoginGuard from "src/components/login/LoginGuard"
import { useUserDispatch } from "src/context/user-info"

const PublisherAgreementPage = () => {
  const { t } = useTranslation()
  const userDispatch = useUserDispatch()
  const router = useRouter()

  const [accepted, setAccepted] = useState(false)

  const content = (
    <div className="prose flex max-w-full flex-col px-[5%] text-justify dark:prose-invert md:px-[20%] 2xl:px-[30%]">
      <h1 className="mb-8 mt-8 text-left text-4xl font-extrabold">
        {t("publisher-agreement")}
      </h1>

      <div>
        <p>
          This publisher submission agreement (“Agreement”) governs your
          submission of content for publication via the Flathub service. As a
          condition to receiving publication services, and for other good
          consideration, the receipt of which is hereby acknowledged, you accept
          and agree to the following terms and conditions for your present and
          future publisher submissions to Flathub.
        </p>
        <ol className="list-decimal">
          <li>
            <p>Definitions.</p>
            <p>
              “You” (or “Your”) shall mean the copyright owner or legal entity
              authorized by the copyright owner that is making this Agreement
              with The Gnome Foundation. For legal entities, the entity making a
              Submission and all other entities that control, are controlled by,
              or are under common control with that entity are considered to be
              a single Publisher. For the purposes of this definition, “control”
              means (i) the power, direct or indirect, to cause the direction or
              management of such entity, whether by contract or otherwise, or
              (ii) ownership of fifty percent (50%) or more of the outstanding
              shares, or (iii) beneficial ownership of such entity.
            </p>
            <p>
              “Submission” shall mean any original work of authorship or
              invention, including any modifications or additions to an existing
              work, that is intentionally submitted by You to Flathub for
              building, packaging, and publication via Flathub.
            </p>
          </li>
          <li>
            <p>
              Grant of Copyright License. Subject to the terms and conditions of
              this Agreement, You hereby grant to Flathub and to recipients of
              software distributed by Flathub a perpetual, worldwide,
              sublicensable, transferable, non-exclusive, no-charge,
              royalty-free, irrevocable copyright license to utilize your
              Submission to build an executable version of your Submission and
              reproduce, publicly display, publicly perform, and distribute Your
              Submissions in original and executable form, as well as the right
              to sublicense and have sublicensed all of the foregoing rights.
            </p>
          </li>
          <li>
            <p>
              Grant of Patent License. Subject to the terms and conditions of
              this Agreement, You hereby grant to Flathub and to recipients of
              software distributed by Flathub a perpetual, worldwide,
              non-exclusive, no-charge, royalty-free, irrevocable (except as
              stated in this section) patent license to make, have made, use,
              offer to sell, sell, import, and otherwise transfer the Submission
              in original and executable form, where such license applies only
              to those patent claims licensable by You that are necessarily
              infringed by Your Submission(s) alone.
            </p>
          </li>
          <li>
            <p>
              You represent that you are legally entitled to grant the licenses
              set forth in this Agreement. You represent that each of Your
              Submissions: a) is Your original creation or that you otherwise
              own or have obtained sufficient rights to grant the licenses set
              forth in this Agreement; b) includes complete details of any
              third-party license or other restriction (including, but not
              limited to, related patents and trademarks) of which you are
              personally aware and which are associated with any part of Your
              Submissions; c) does not, to your knowledge, infringe the
              intellectual property rights of any third party; d) does not, to
              your knowledge, violate any applicable laws or regulations.
            </p>
          </li>
          <li>
            <p>
              So long as you fully comply with the terms of this Agreement
              (including granting the unhindered license rights in this
              Agreement to all recipients of your Submission who obtain your
              Submission via Flathub), you may, if you choose, place additional
              contractual restrictions on your Submission via a license file,
              which will be distributed with your Submission via Flathub.
            </p>
          </li>
          <li>
            <p>
              You are not expected to provide support for Your Submissions,
              except to the extent You desire to provide support. You may
              provide support for free, for a fee, or not at all. Unless
              required by applicable law or agreed to in writing, You provide
              Your Submissions on an “AS IS” BASIS, WITHOUT WARRANTIES OR
              CONDITIONS OF ANY KIND, either express or implied, including,
              without limitation, any warranties or conditions of title,
              non-infringement, merchantability, or fitness for a particular
              purpose.
            </p>
          </li>
          <li>
            <p>
              You agree to notify Flathub of any facts or circumstances of which
              you become aware that would make these representations inaccurate
              in any respect.
            </p>
          </li>
        </ol>
      </div>

      <hr className="my-8" />

      <div>
        <input
          type="checkbox"
          className="mr-2"
          id="agree"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <label htmlFor="agree" className="mb-8">
          {t("publisher-agreement-accept")}
        </label>
      </div>

      <Button
        className="mt-6"
        disabled={!accepted}
        onClick={async () => {
          if (accepted) {
            await acceptPublisherAgreement(userDispatch)
            router.push("/apps/new/register")
          }
        }}
      >
        {t("continue")}
      </Button>
    </div>
  )

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={t("publisher-agreement")} noindex />
      <LoginGuard>{content}</LoginGuard>
    </div>
  )
}

export default PublisherAgreementPage

// Need available login providers to show options on page
export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
