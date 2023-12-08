FROM public.ecr.aws/lambda/nodejs:18 as builder
# We intentionally do not set a default value 
# because we want to provide a specific snooty parser
# version every time.
ARG SNOOTY_PARSER_VERSION
WORKDIR /usr/app

RUN yum install -y curl

RUN curl -L -o snooty-parser.zip https://github.com/mongodb/snooty-parser/releases/download/v${SNOOTY_PARSER_VERSION}/snooty-v${SNOOTY_PARSER_VERSION}-linux_x86_64.zip \
    && unzip -d /opt/ snooty-parser.zip

COPY package.json api/ src/  ./
RUN npm ci
RUN npm run build:esbuild:lambda

FROM public.ecr.aws/lambda/nodejs:18

COPY --from=builder dist/ ${LAMBDA_TASK_ROOT}

CMD ["index.handler"]