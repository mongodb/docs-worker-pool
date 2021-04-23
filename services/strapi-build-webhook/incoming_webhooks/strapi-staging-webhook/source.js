// This function is the webhook's request handler.
exports = async function (payload, response) {
  const { email, name } = await JSON.parse(await payload.body.text());

  try {
    let jobTitle = "DevHub CMS Staging Build";
    let jobUserName = name;
    let jobUserEmail = email;
    const newPayload = {
      jobType: "githubPush",
      source: "strapi",
      action: "push",
      repoName: "devhub-content-integration",
      branchName: "test-strapi-webhook",
      isFork: true,
      private: true,
      isXlarge: true,
      // Can this be generalized to use the devhub-content master branch instead of my fork?
      repoOwner: "jestapinski",
      url: "https://github.com/jestapinski/devhub-content-integration.git",
      newHead: "47796f9291f8237aaaaf2d9afcb5eec73566e156",
    };

    context.functions.execute(
      "addJobToQueue",
      newPayload,
      jobTitle,
      jobUserName,
      jobUserEmail
    );
  } catch (err) {
    console.log(err);
  }
};
